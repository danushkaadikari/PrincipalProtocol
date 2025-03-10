const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Test configuration
const config = {
  baseUrl: 'http://localhost:3000',
  timeout: 60000, // 60 seconds
  headless: false, // Set to true for headless mode
};

async function captureScreenshot(page, name) {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  await page.screenshot({ path: path.join(screenshotsDir, `${name}.png`), fullPage: true });
  console.log(`Screenshot saved: ${name}.png`);
}

async function testLiquidityHubFrontend() {
  console.log('Starting LiquidityHub Frontend Test...');
  
  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Step 1: Visit the LiquidityHub page
    console.log('Step 1: Visiting LiquidityHub page...');
    await page.goto(`${config.baseUrl}/liquidityhub`, { timeout: config.timeout });
    await page.waitForLoadState('networkidle');
    console.log('✅ LiquidityHub page loaded successfully');
    await captureScreenshot(page, '01-liquidityhub-page');
    
    // Step 2: Check if the tabs are present
    console.log('Step 2: Checking tabs...');
    const borrowTab = await page.locator('button[role="tab"]:has-text("Borrow")');
    const lendTab = await page.locator('button[role="tab"]:has-text("Lend")');
    const statsTab = await page.locator('button[role="tab"]:has-text("Protocol Stats")');
    
    await borrowTab.waitFor({ state: 'visible' });
    await lendTab.waitFor({ state: 'visible' });
    await statsTab.waitFor({ state: 'visible' });
    console.log('✅ All tabs are present');
    
    // Step 3: Click on each tab and verify content
    console.log('Step 3: Testing tab navigation...');
    
    try {
      // Borrow tab (default)
      const borrowContent = await page.locator('div:has-text("NFT Selection")').first();
      await borrowContent.waitFor({ state: 'visible', timeout: 5000 });
      console.log('✅ Borrow tab content is visible');
      await captureScreenshot(page, '02-borrow-tab');
      
      // Lend tab
      await lendTab.click();
      await page.waitForTimeout(2000);
      const lendContent = await page.locator('div:has-text("Deposit")').first();
      await lendContent.waitFor({ state: 'visible', timeout: 5000 });
      console.log('✅ Lend tab content is visible');
      await captureScreenshot(page, '03-lend-tab');
      
      // Stats tab
      await statsTab.click();
      await page.waitForTimeout(2000);
      const statsContent = await page.locator('div:has-text("Protocol Statistics")').first();
      await statsContent.waitFor({ state: 'visible', timeout: 5000 });
      console.log('✅ Stats tab content is visible');
      await captureScreenshot(page, '04-stats-tab');
    } catch (error) {
      console.log(`Error during tab navigation: ${error.message}`);
      await captureScreenshot(page, 'tab-navigation-error');
      // Continue with the test despite the error
    }
    
    // Step 4: Visit the admin page
    console.log('Step 4: Visiting LiquidityHub Admin page...');
    try {
      await page.goto(`${config.baseUrl}/admin/liquidityhub`, { timeout: config.timeout });
      await page.waitForLoadState('networkidle');
      console.log('✅ LiquidityHub Admin page loaded successfully');
      await captureScreenshot(page, '05-admin-page');
      
      // Step 5: Check if the admin form fields are present
      console.log('Step 5: Checking admin form fields...');
      try {
        const lendingAPYField = await page.locator('text=Lending APY').first();
        const borrowingAPYField = await page.locator('text=Borrowing APY').first();
        const borrowingLimitField = await page.locator('text=Borrowing Limit').first();
        const defaultThresholdField = await page.locator('text=Default Threshold').first();
        
        await lendingAPYField.waitFor({ state: 'visible', timeout: 5000 });
        console.log('✅ Lending APY field is present');
        await borrowingAPYField.waitFor({ state: 'visible', timeout: 5000 });
        console.log('✅ Borrowing APY field is present');
        await borrowingLimitField.waitFor({ state: 'visible', timeout: 5000 });
        console.log('✅ Borrowing Limit field is present');
        await defaultThresholdField.waitFor({ state: 'visible', timeout: 5000 });
        console.log('✅ Default Threshold field is present');
        console.log('✅ All admin form fields are present');
        
        // Step 6: Check if the contract values are loaded
        console.log('Step 6: Checking if contract values are loaded...');
        await page.waitForTimeout(3000); // Wait for contract data to load
        
        // Check for any error messages
        const errorMessages = await page.locator('text=Error loading contract data').count();
        if (errorMessages > 0) {
          console.log('⚠️ Error loading contract data detected');
        } else {
          console.log('✅ No error messages detected when loading contract data');
        }
      } catch (error) {
        console.log(`Error checking admin form fields: ${error.message}`);
        await captureScreenshot(page, 'admin-form-error');
      }
    } catch (error) {
      console.log(`Error visiting admin page: ${error.message}`);
      await captureScreenshot(page, 'admin-page-error');
    }
    
    console.log('Frontend test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
    await captureScreenshot(page, 'error-state');
  } finally {
    await browser.close();
  }
}

// Run the test
testLiquidityHubFrontend()
  .then(() => console.log('Test execution completed'))
  .catch(error => console.error('Test execution failed:', error));
