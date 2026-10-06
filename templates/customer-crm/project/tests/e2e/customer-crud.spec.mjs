import {test,expect} from '../testkit/apex.mjs';
// The runner supplies this fixture in its isolated run directory.
// Runtime evidence is required before this fixture can be called verified.
test('authenticated customer CRUD and invalid email',async({page})=>{
 // Interactive report searches add cumulative filters that persist in the session; clear them before each search.
 const search=async(text)=>{const remove=page.getByRole('button',{name:'Remove Filter'});for(let n=await remove.count();n>0;n--){await remove.first().click();await expect(remove).toHaveCount(n-1);}
  const field=page.locator('#customers_report_search_field');await field.fill(text);await field.press('Enter');};
 const suffix=crypto.randomUUID().replaceAll('-','');const name=`APEXREST ${suffix}`,updated=`Updated ${suffix}`,email=`${suffix}@example.test`;
 await page.goto('./customers');await expect(page.getByTestId('apexrest-crm')).toBeVisible();
 await page.getByRole('button',{name:'Create Customer',exact:true}).click();
 let form=page.frameLocator('iframe[title="Customer"]');
 await form.getByLabel('Name',{exact:true}).fill(name);await form.getByLabel('Email',{exact:true}).fill('invalid');await form.getByLabel('Status',{exact:true}).selectOption('ACTIVE');
 await form.getByRole('button',{name:'Create',exact:true}).click();await expect(form.getByText('Enter a valid email address.',{exact:false})).toBeVisible();
 await form.getByLabel('Email',{exact:true}).fill(email);await form.getByRole('button',{name:'Create',exact:true}).click();await expect(page.locator('iframe[title="Customer"]')).toHaveCount(0);
 try {
  await search(name);await expect(page.getByRole('cell',{name,exact:true})).toBeVisible();
  await page.getByRole('row').filter({has:page.getByRole('cell',{name,exact:true})}).getByRole('link',{name:'Edit customer'}).click();
  form=page.frameLocator('iframe[title="Customer"]');await expect(form.getByLabel('Email',{exact:true})).toHaveValue(email);await form.getByLabel('Name',{exact:true}).fill(updated);await form.getByRole('button',{name:'Apply Changes',exact:true}).click();await expect(page.locator('iframe[title="Customer"]')).toHaveCount(0);
  await search(updated);await expect(page.getByRole('cell',{name:updated,exact:true})).toBeVisible();
 } finally {
  await search(suffix);
  const row=page.getByRole('row').filter({has:page.getByRole('cell',{name:email,exact:true})});
  if(await row.count()){
   await row.getByRole('link',{name:'Edit customer'}).click();form=page.frameLocator('iframe[title="Customer"]');await form.getByRole('button',{name:'Delete',exact:true}).click();
   await page.getByRole('alertdialog').getByRole('button',{name:'Delete',exact:true}).click();await expect(page.locator('iframe[title="Customer"]')).toHaveCount(0);await expect(page.getByRole('cell',{name:email,exact:true})).toHaveCount(0);
  }
 }
});
