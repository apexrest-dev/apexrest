# ADR 004: credentials

Status: accepted for local beta; integration claims require evidence.

Use named SQLcl store references without passwords in project JSON or argv. Keep browser state private. Project trust and target grants live outside the repository; production keys/configuration belong to a protected runner. Full shell permission remains outside this library security boundary.
