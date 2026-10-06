import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import java.util.logging.*;
import java.util.regex.*;
import java.util.zip.*;
import javax.sql.rowset.serial.SerialClob;
import oracle.dbtools.extension.apex.core.apexlang.APEXLangTranspiler;
import oracle.dbtools.extension.apex.core.apexlang.APEXLangDeploymentFile;
import oracle.dbtools.extension.apex.core.apexlang.APEXSessionProperty;
import oracle.dbtools.extension.apex.utility.APEXLangUtils;
import oracle.apexlang.core.DeploymentValue;
import oracle.apexlang.core.DeploymentFileProperty;

/** Runs against the Oracle compiler and OREST driver distributed with SQLcl 26.1+.
 * Credentials arrive only on stdin. Jobs and reports must never contain passwords.
 * This is an internal bridge, not a replacement APEXlang compiler.
 */
public class OrdsBridge {
    static final ObjectMapper JSON = new ObjectMapper();
    static final long MAX_BYTES = 512L * 1024 * 1024;
    static final String IMPORT_BLOCK = """
        begin
          for b in (select ordinal, source from json_table(?, '$[*]'
              columns (ordinal for ordinality, source clob path '$' error on error))
              order by ordinal) loop
            execute immediate b.source;
          end loop;
        end;
        """;
    static String password = "";

    public static void main(String[] args) throws Exception {
        ObjectNode result = JSON.createObjectNode();
        Path report = null;
        int exit = 0;
        try {
            if (args.length != 1) throw new IllegalArgumentException("Expected one job file path");
            JsonNode job = JSON.readTree(Files.readString(Path.of(args[0])));
            report = Path.of(required(job, "output")).toAbsolutePath().normalize();
            String operation = required(job, "operation");
            result.put("operation", operation);
            if (operation.equals("compile")) {
                List<String> blocks = compile(job, result);
                result.put("statement", IMPORT_BLOCK);
                result.set("blocks", JSON.valueToTree(blocks));
            } else if (operation.equals("prepare-script")) {
                result.put("script", script(job));
            } else {
                JsonNode credentials;
                try { credentials = JSON.readTree(System.in); }
                catch (IOException error) { throw new IllegalArgumentException("Invalid credentials JSON on stdin"); }
                password = required(credentials, "password");
                try (Connection connection = connect(credentials)) {
                    if (operation.equals("import")) {
                        List<String> blocks = compile(job, result);
                        if (!result.path("targetConfigured").asBoolean())
                            throw new IllegalArgumentException("Import requires workspace, parsingSchema and applicationId");
                        try (CallableStatement statement = connection.prepareCall(IMPORT_BLOCK)) {
                            statement.setClob(1, new SerialClob(JSON.writeValueAsString(blocks).toCharArray()));
                            result.put("writeStarted", true);
                            checkpoint(report, result);
                            statement.execute();
                        }
                        result.put("message", "Import successful");
                    } else if (operation.equals("export")) {
                        export(connection, job, result);
                    } else if (operation.equals("script")) {
                        String source = script(job);
                        result.put("writeStarted", true);
                        checkpoint(report, result);
                        executeScript(connection, source, result);
                    } else throw new IllegalArgumentException("Unsupported operation");
                }
            }
            result.put("status", "succeeded");
        } catch (Exception error) {
            exit = 1;
            result.put("status", "failed");
            result.put("code", "ORDS_BRIDGE_FAILED");
            String message = error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
            result.put("message", password.isEmpty() ? message : message.replace(password, "[REDACTED]"));
        }
        if (report != null) {
            Files.createDirectories(report.getParent());
            Files.writeString(report, JSON.writerWithDefaultPrettyPrinter().writeValueAsString(result) + "\n");
        }
        // No source, query results, URL, or credential values are printed to the process log.
        System.out.println(exit == 0 ? "APEXREST_ORDS_COMPLETE" : "APEXREST_ORDS_FAILED");
        if (exit != 0) System.exit(exit);
    }

    static String required(JsonNode node, String key) {
        if (node == null || !node.path(key).isTextual() || node.path(key).asText().isBlank())
            throw new IllegalArgumentException("Missing " + key);
        return node.path(key).asText();
    }

    static void checkpoint(Path report, ObjectNode result) throws IOException {
        ObjectNode pending = result.deepCopy();
        pending.put("status", "failed");
        pending.put("code", "ORDS_OUTCOME_UNKNOWN");
        pending.put("message", "The ORDS write started but no final result was recorded");
        Files.createDirectories(report.getParent());
        Files.writeString(report, JSON.writeValueAsString(pending) + "\n");
    }

    static Connection connect(JsonNode credentials) throws Exception {
        URI uri = URI.create(required(credentials, "url"));
        if (!("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) || uri.getHost() == null
                || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null)
            throw new IllegalArgumentException("Invalid ORDS schema URL");
        String url = uri.toString();
        if (url.matches(".*/_/sql/?$")) throw new IllegalArgumentException("Use the ORDS schema URL, without /_/sql");
        if (!url.endsWith("/")) url += "/";
        Properties properties = new Properties();
        properties.setProperty("user", required(credentials, "username"));
        properties.setProperty("password", password);
        Logger.getLogger("oracle.dbtools").setLevel(Level.WARNING);
        Connection connection = new oracle.dbtools.jdbc.orest.Driver().connect("jdbc:oracle:orest:@" + url, properties);
        if (connection == null) throw new SQLException("The SQLcl OREST driver rejected the URL");
        return connection;
    }

    // SQLcl 26.3 moved the compiler into .core; support the pinned 26.1 layout too.
    static List<DeploymentFileProperty> deploymentProperties(String version) throws Exception {
        Class<?> compiler;
        try { compiler = Class.forName("oracle.apexlang.core.APEXLangCompiler"); }
        catch (ClassNotFoundException oldLayout) { compiler = Class.forName("oracle.apexlang.APEXLangCompiler"); }
        Object instance = compiler.getMethod("getInstance", String.class).invoke(null, version);
        Object value = compiler.getMethod("getDeploymentFileProperties").invoke(instance);
        if (!(value instanceof List<?> list)) throw new IllegalStateException("Unsupported deployment property contract");
        List<DeploymentFileProperty> properties = new ArrayList<>();
        for (Object item : list) properties.add(DeploymentFileProperty.class.cast(item));
        return properties;
    }

    static List<String> compile(JsonNode job, ObjectNode result) throws Exception {
        Path input = Path.of(required(job, "input")).toRealPath();
        Path deployment = Path.of(required(job, "deployment")).toRealPath();
        if (!Files.isDirectory(input)) throw new IllegalArgumentException("The bridge requires a staged APEXlang directory");
        Path metadata = input.resolve(".apex/apexlang.json");
        String version = required(JSON.readTree(Files.readString(metadata)), "mmdVersion");
        APEXLangTranspiler transpiler = new APEXLangTranspiler(version);
        Map<String, DeploymentValue> values = new HashMap<>();
        APEXLangUtils.populateDeploymentInfo(values, List.of("subscription.masterApps", "subscription.mode"),
            APEXSessionProperty.getAPEXSessionProperties(deploymentProperties(version)),
            new APEXLangDeploymentFile(deployment), null, null, null);
        var compilation = transpiler.transpile(input, values);
        result.put("compilerMmdVersion", transpiler.getCompilerMmdVersion());
        if (compilation.getWarnings() != null && compilation.getWarnings().length > 0)
            result.put("warnings", transpiler.formatWarnings(compilation.getWarnings()));
        if (compilation.getErrors().length > 0)
            throw new IllegalArgumentException(transpiler.formatErrors(compilation.getErrors()));
        List<String> blocks = new ArrayList<>();
        JsonNode configuration = JSON.readTree(Files.readString(deployment));
        long applicationId = job.path("applicationId").asLong(configuration.path("app").path("id").asLong(0));
        String workspace = job.path("workspace").asText(configuration.path("workspace").path("name").asText(""));
        String schema = job.path("parsingSchema").asText(configuration.path("app").path("databaseSession").path("parsingSchema").asText(""));
        if (applicationId > 0 && !workspace.isBlank() && !schema.isBlank()) {
            blocks.add("begin apex_application_install.clear_all; apex_application_install.set_workspace(" + literal(workspace)
                + "); apex_application_install.set_application_id(" + applicationId + "); apex_application_install.set_schema("
                + literal(schema) + "); end;");
            result.put("targetConfigured", true);
        }
        compilation.processPlSqlOutput(blocks::add);
        if (blocks.isEmpty()) throw new IllegalArgumentException("Oracle compiler produced no import blocks");
        long size = blocks.stream().mapToLong(s -> s.getBytes(StandardCharsets.UTF_8).length).sum();
        if (size > MAX_BYTES) throw new IllegalArgumentException("Compiled import exceeds the bridge payload limit");
        result.put("blockCount", blocks.size());
        result.put("compiledBytes", size);
        result.put("databaseRequests", 1);
        return blocks;
    }

    static String literal(String value) { return "'" + value.replace("'", "''") + "'"; }

    static void export(Connection connection, JsonNode job, ObjectNode result) throws Exception {
        long applicationId = job.path("applicationId").asLong(0);
        if (applicationId <= 0) throw new IllegalArgumentException("Invalid applicationId");
        String format = required(job, "exportType");
        if (format.equals("APPLICATION_SOURCE")) format = "SQL";
        if (!Set.of("APEXLANG", "SQL").contains(format)) throw new IllegalArgumentException("Unsupported exportType");
        String sql = """
            declare
              l_files apex_t_export_files;
              l_zip blob;
            begin
              l_files := apex_export.get_application(
                p_application_id => ?, p_type => ?, p_split => ? = 1,
                p_with_date => false, p_with_original_ids => true,
                p_with_comments => true, p_with_supporting_objects => 'Y');
              l_zip := apex_export.zip(l_files);
              ? := apex_web_service.blob2clobbase64(l_zip, p_newlines => 'N', p_padding => 'Y');
            end;
            """;
        String encoded;
        try (CallableStatement statement = connection.prepareCall(sql)) {
            statement.setLong(1, applicationId);
            statement.setString(2, format);
            statement.setInt(3, job.path("split").asBoolean(true) ? 1 : 0);
            statement.registerOutParameter(4, Types.CLOB);
            statement.execute();
            Clob content = statement.getClob(4);
            if (content == null || content.length() == 0 || content.length() > MAX_BYTES * 2)
                throw new IOException("Missing or oversized export response");
            encoded = content.getSubString(1, Math.toIntExact(content.length()));
        }
        // SQLcl 26.1's OREST getClob serializes the JSON scalar, including its quotes.
        // Decode that scalar once; accept raw text if a later driver corrects this behavior.
        if (encoded.startsWith("\"")) {
            JsonNode scalar = JSON.readTree(encoded);
            if (!scalar.isTextual()) throw new IOException("Invalid export CLOB response");
            encoded = scalar.asText();
        }
        Path directory = Path.of(required(job, "outputDirectory")).toAbsolutePath().normalize();
        List<String> files = extractZip(Base64.getDecoder().decode(encoded.replaceAll("\\s", "")), directory);
        if (format.equals("APEXLANG") && files.stream().noneMatch(f -> f.endsWith(".apex/apexlang.json")))
            throw new IOException("APEXlang export lacks Oracle .apex/apexlang.json metadata");
        result.set("files", JSON.valueToTree(files));
        result.put("outputDirectory", directory.toString());
        result.put("message", "Export successful");
    }

    static List<String> extractZip(byte[] archive, Path directory) throws Exception {
        if (Files.exists(directory)) {
            if (Files.isSymbolicLink(directory)) throw new IOException("Export directory cannot be a symbolic link");
            try (var entries = Files.list(directory)) {
                if (entries.findAny().isPresent()) throw new IOException("Export directory must be empty");
            }
        } else Files.createDirectories(directory);
        Path root = directory.toRealPath();
        List<String> files = new ArrayList<>();
        long total = 0;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(archive), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String name = entry.getName();
                Path target = root.resolve(name).normalize();
                if (name.contains("\\") || !target.startsWith(root) || target.equals(root) || name.startsWith("/"))
                    throw new IOException("Unsafe export archive path");
                if (entry.isDirectory()) { Files.createDirectories(target); continue; }
                Files.createDirectories(target.getParent());
                try (OutputStream out = Files.newOutputStream(target, StandardOpenOption.CREATE_NEW)) {
                    byte[] buffer = new byte[65536];
                    int read;
                    while ((read = zip.read(buffer)) >= 0) {
                        total += read;
                        if (total > MAX_BYTES) throw new IOException("Export archive exceeds the bridge payload limit");
                        out.write(buffer, 0, read);
                    }
                }
                files.add(name);
            }
        }
        if (files.isEmpty()) throw new IOException("Empty export archive");
        return files;
    }

    static String script(JsonNode job) throws Exception {
        Path input = Path.of(required(job, "input")).toRealPath();
        return expandScript(input, input.getParent(), new HashSet<>());
    }

    static String expandScript(Path input, Path root, Set<Path> active) throws Exception {
        input = input.toRealPath();
        if (!input.startsWith(root) || !active.add(input)) throw new IOException("Unsafe or cyclic SQL include");
        StringBuilder output = new StringBuilder();
        Pattern include = Pattern.compile("^\\s*@@?(?:\"([^\"]+)\"|'([^']+)'|([^\\s]+))\\s*$");
        for (String line : Files.readAllLines(input, StandardCharsets.UTF_8)) {
            Matcher match = include.matcher(line);
            if (match.matches()) {
                String name = match.group(1) != null ? match.group(1) : match.group(2) != null ? match.group(2) : match.group(3);
                Path child = input.getParent().resolve(name);
                if (!Files.exists(child) && !name.endsWith(".sql")) child = input.getParent().resolve(name + ".sql");
                output.append(expandScript(child, root, active));
            } else {
                if (line.stripLeading().startsWith("@")) throw new IOException("Unsupported SQL include syntax");
                output.append(line).append('\n');
            }
            if (output.length() > MAX_BYTES) throw new IOException("SQL script exceeds the bridge payload limit");
        }
        active.remove(input);
        return output.toString();
    }

    static void executeScript(Connection connection, String sql, ObjectNode result) throws Exception {
        if (!(connection instanceof oracle.dbtools.jdbc.Connection restConnection))
            throw new SQLException("Expected the SQLcl REST connection implementation");
        try (ScriptStatement rest = new ScriptStatement(restConnection)) {
            try (var response = rest.orestExecuteInternal(sql)) {
                if (response == null) throw new SQLException("ORDS script produced no HTTP response");
                if (response.getCode() < 200 || response.getCode() >= 300)
                    throw new SQLException("ORDS script HTTP status " + response.getCode());
                JsonNode body = JSON.readTree(response.getEntity().getContent());
                if (!body.path("items").isArray() || body.path("items").isEmpty())
                    throw new SQLException("ORDS returned no script execution results");
                int statements = 0;
                for (JsonNode item : body.path("items")) {
                    statements++;
                    String messages = item.path("response").toString();
                    if (item.path("errorCode").asInt(0) != 0 || item.hasNonNull("errorDetails") || item.path("result").asInt(0) < 0
                            || Pattern.compile("(?i)ORA-\\d+|PLS-\\d+|SP2-\\d+|unknown command|error at line").matcher(messages).find())
                        throw new SQLException("ORDS script failed at statement " + statements + ": " + messages);
                }
                result.put("statementCount", statements);
                result.put("message", "Script execution successful");
            }
        }
    }

    /** The driver's default emulate=jdbc payload is for individual JDBC statements.
     * Full SQL*Plus scripts use ORDS's documented statementText script format instead.
     */
    static class ScriptStatement extends oracle.dbtools.jdbc.Statement {
        ScriptStatement(oracle.dbtools.jdbc.Connection connection) { super(connection); }
        @Override protected AbstractMap.SimpleEntry<com.fasterxml.jackson.core.JsonGenerator, Writer>
                generatePost(String sql, int offset) throws SQLException {
            try {
                Writer out = new StringWriter();
                var generator = JSON.getFactory().createGenerator(out);
                generator.writeStartObject();
                generator.writeStringField("statementText", sql);
                generator.writeEndObject();
                generator.flush();
                return new AbstractMap.SimpleEntry<>(generator, out);
            } catch (IOException error) { throw new SQLException("Could not encode the ORDS script", error); }
        }
    }
}
