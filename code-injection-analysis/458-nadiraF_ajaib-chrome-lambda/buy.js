const puppeteer = require('puppeteer-core');
const selectors = require('./selectors');
let isBuying = false;
let checkStopLossTrailStopInterval;
let checkLoop;
// require("dotenv").config();
// require("dotenv").config();
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
async function clickByCheckingIsThereClass(page, className, elementClick) {
  await delay(5000);
  const popUp= await page.waitForSelector(`.${className}`);
  if(popUp){
    const nantiSaja= await page.$(elementClick);
    await nantiSaja.click();
  }
}
async function clickByClass(page, className) {
    try {
      await page.waitForSelector(`.${className}`);
      await page.click(`.${className}`);
      // console.log(`Clicked element with class: ${className}`);
      return true;
    } catch (error) {
      console.error(`Error clicking element with class ${className}:`, error.stack);
      return false;
    }
}
// Define getdivisor function
function getdivisor(priceini) {
  console.log('get divisor');
  let price = parseInt(priceini, 10);
  let divisor;
  if (price < 200) {
    divisor = 1;
  } else if (200 <= price && price < 500) {
    divisor = 2;
  } else if (500 <= price && price < 2000) {
    divisor = 5;
  } else if (2000 <= price && price < 5000) {
    divisor = 10;
  } else {
    divisor = 25;
  }
  console.log('selesai get divisor');
  return divisor;
}
// Define setgainloss function
function setgainloss(pricei, loss, gain) {
  console.log('set gain loss with price: ',pricei);
  const divisor = getdivisor(pricei);
  let pricep;
  if (pricei < 40) {
    // If it has a decimal, remove the decimal by multiplying by 1000
    pricep = Math.round(pricei * 1000);
  }else{
    pricep = pricei;
  }
  console.log('price in function setgainloss ', pricep)

  // Adjusting loss and gain based on the divisor
  const losspp = (loss / 100);
  const lossp = (1 - losspp);
  const lossini = Math.floor(pricep * lossp); // Round down using Math.floor()
  
  const gainpp = (gain / 100);
  const gainp = (1 + gainpp);
  const gainini = Math.ceil(pricep * gainp); // Round up using Math.ceil()
  
  let adjusted_loss = lossini;
  while (adjusted_loss % divisor !== 0) {
    adjusted_loss -= 1;
  }

  let adjusted_gain = gainini;
  while (adjusted_gain % divisor !== 0) {
    adjusted_gain -= 1;
  }

  const divisorgain = getdivisor(adjusted_gain);
  const divisorloss = getdivisor(adjusted_loss);
  console.log('check lg');
  if (divisorloss === divisor) {
    if (divisorgain === divisor) {
      // No adjustment needed
    }
  } else {
    while (adjusted_loss % divisorloss !== 0) {
      adjusted_loss -= 1;
    }
    if (divisorgain !== divisor) {
      while (adjusted_gain % divisorgain !== 0) {
        adjusted_gain -= 1;
      }
    }
  }

  return { adjusted_loss, adjusted_gain };
}
const cekRiwayat = async (page,browser, req,res) => {
  const { isSold, price, aksi, stockName2, status } = await checkingRiwayat(page);
  res.send({
  isSold: isSold || 'Not found',
  price: price || 'Not found',
  aksi: aksi || 'Not found',
  stockName2: stockName2 || 'Not found',
  status: status || 'Not found'
  });
}
async function checkingRiwayat(page){
    //cek halaman
    const urlNow = await clickAndWaitForUrl(page, '/home');
    //open riwayat
    const riwayatButton = await page.$(selectors.riwayatTransactionButton);
    await riwayatButton.click();
    const dayTradeRiwayatButton = await page.$(selectors.riwayatDayTrade);
    await dayTradeRiwayatButton.click();   
    await delay(2000);
    // Scrape the data from the first row of the table
    const data = await page.evaluate(() => {
      const table = document.querySelector('.css-ryf5o1');
        
      // Ensure the table exists
      if (!table) {
          return null;  // No table found
      }

      // Get the first row of the table
      const firstRow = table.querySelector('tbody tr');

      if (!firstRow) {
          return null;  // No rows found
      }

      // Extract "aksi" (order type) from the 3rd column (Order type: Buy/Sell)
      const aksi = firstRow.querySelector('td:nth-child(3)')?.innerText.trim() || '';

      // Extract "stockName" from the 4th column (Stock Name)
      const stockName2 = firstRow.querySelector('td:nth-child(4) a')?.innerText.trim() || '';

      // Extract "status" from the 8th column (Transaction Status)
      const status = firstRow.querySelector('td:nth-child(8)')?.innerText.trim() || '';

      // Extract "price" from the 6th column (Price)
      const rawPrice = firstRow.querySelector('td:nth-child(6)')?.innerText.trim() || '';
     // Remove "Rp" and dots from price, then parse as number
     const price = parseInt(rawPrice.replace(/Rp|\./g, ''));
     // Return all the extracted data
     return { aksi, price, stockName2, status };
   });
   if (!data) {
    return { isSold: false, price: '',aksi: '', stockName2: '', status: 'No data found' };
  }

  // Check if the transaction is today

  // Check if the stock has already been sold
  const isSold = data.status.toLowerCase() === 'done';  // Assuming "Done" means the stock is sold
  console.log(`isSold: ${isSold}, price: ${data.price}, aksi: ${data.aksi}, stockName2: ${data.stockName2}, status: ${data.status}`);

  return { isSold, price: data.price, aksi: data.aksi, stockName2: data.stockName2, status: data.status };
}
// Click element and wait for navigation to complete
async function clickAndWaitForUrlEvenJustChange(page, urlPattern) {
  // Set up navigation promise before clicking
  // This will wait for navigation, but we can set a timeout if it's taking too long
  const navigationPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 })
  .catch(() => console.log("Navigation didn't happen in time"));

  // Alternatively, you could wait for the URL change using the 'waitForFunction' to check for a URL match in SPAs
  const urlChanged = page.waitForFunction(`window.location.href.includes('${urlPattern}')`, {
    timeout: 30000
  }).catch(() => console.log("URL didn't change in time"));

  // Wait for either one to finish
  console.log('before');
  await Promise.race([navigationPromise, urlChanged]);
  console.log('after');
  // Check if we're at the expected URL
  const currentUrl = page.url();
  return currentUrl.includes(urlPattern);
}
async function checkURL(page, urlPattern){
  if (!page) throw new Error('Page object is undefined');
  const currURL = page.url();
  
  return currURL.match(urlPattern);  // Return current URL if already matched
}
async function clickAndWaitForUrl(page, urlPattern) {
  const currentUrl = page.url();
  if (currentUrl.match(urlPattern)) {
      console.log('Already at the expected URL, no need to wait for navigation.');
      return currentUrl;  // Return current URL if already matched
  } else {
    // Set up navigation promise before clicking
    console.log('wait navigation');
    const navigationPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded' });
    
    // Wait for navigation to complete
    await navigationPromise;
    console.log('finish navigation');
    // Check if we're at the expected URL
    const currentUrl = page.url();
    return currentUrl.includes(urlPattern);
  }
  }
async function login(page) {
  try {
    await page.goto('https://login.ajaib.co.id/login',{waitUntil: 'domcontentloaded'}); // Replace with your desired URL
    console.log('link opened');
  } catch (error){
      console.error('An error occurred:', error.message);
  }
  // Wait for some element (adjust the selector based on the page)
  try{
      await page.waitForSelector(selectors.loginGmailText);
      const LoginGmailInput = await page.$(selectors.loginGmailText);
      await page.$eval(selectors.loginGmailText, element => element.value='');
      const loginPasswordInput = await page.$(selectors.loginPasswordText);
      await page.$eval(selectors.loginPasswordText, element => element.value='');
      const Loginbutton= await page.$(selectors.loginMasukButton);
      const gmail = process.env.AJ_GMAIL;
      await LoginGmailInput.type(gmail);
      await loginPasswordInput.type(process.env.AJ_PASSWORD);
      await Loginbutton.click();
      console.log('succesfully loged');
  } catch (error){
      console.error('An error occurred:', error.message);
      console.error('Error Stack:', error.stack);
  }
}
async function sell(page, stockName){
  try{
  const jualButtonTab=await page.$(selectors.jualButtonTab);
  await jualButtonTab.click();
  const DayTradeButton= await page.$(selectors.dayTradingButton);
  await DayTradeButton.click();
  const dayTrade100Button= await page.$(selectors.dayTrade100PercentBuyingPower);
  await dayTrade100Button.click();
   // Get the price value from the page (e.g., input field or element containing price)
  const priceText = await page.$eval(selectors.inputPriceBox, element => element.textContent || element.value);
  
  // // Parse the price into an integer (e.g., 3780 as number)
  // let priceInt = parseInt(priceText.replace('.', ''), 10);    
  // // Example gain and loss values (percentage)

  // console.log(`start call setgainloss ${priceInt}`);
  // console.log(`Price: ${priceInt}`);
  // const gain = 1; // 10% gain
  // const loss = 1;  // 5% loss
  // // Calculate adjusted loss and gain
  // const { adjusted_loss, adjusted_gain } = setgainloss(priceInt, loss, gain);

  
  // console.log(`Adjusted Loss: ${adjusted_loss}`);
  // console.log(`Adjusted Gain: ${adjusted_gain}`);
  const result = await checkbidask(page, stockName);
  await page.$eval(selectors.inputPriceBox, element => element.value='');
  const sellPriceInputBox = await page.$(selectors.inputPriceBox);
  console.log('sell in price',result.bidPrice);
  const adjustedGainString= result.bidPrice.toString();
  await sellPriceInputBox.type(adjustedGainString);
  const sellButton= await page.$(selectors.jualButton);
  await sellButton.click(); //jemur
  await page.waitForSelector(selectors.jualPopUp);
  const jualPopUpButton = await page.$(selectors.jualPopUp);
  await jualPopUpButton.click();
  console.log('succesfully selling');
  }catch(error){
  }
}
async function isValidAjaibHomeURL(page, stockName) {
  const url = await page.url(); // Get the current URL from Puppeteer page
  
  // Check if URL contains /home/{stockName}
  const isInCorrectLink = url.includes(`/home/saham/${encodeURIComponent(stockName)}`);
  
  // Check if URL contains /home/
  const hasHome = url.includes('/home/');
  console.log(`URL : ${url}`);
  console.log(`URL contains '/home/saham/${encodeURIComponent(stockName)}': ${isInCorrectLink}`);
  console.log(`URL contains '/home/': ${hasHome}`);
  
  return { isInCorrectLink, hasHome };
}
async function checkbidask(page, stockName){
  try {
    const { isInCorrectLink, hasHome } = await isValidAjaibHomeURL(page,stockName);
    if (!isInCorrectLink) {
      // Get all price containers
      if (!hasHome){
        await delay(10000); 
      }
      await page.waitForSelector(selectors.cariAssetSearchBox, { timeout : 10000 });
      await page.$eval(selectors.cariAssetSearchBox, element => element.value='');
      const StockNameInput = await page.$(selectors.cariAssetSearchBox);
      await StockNameInput.type(stockName.toString());
      await delay(2000);
      await clickByClass(page,'css-2b5fr2');
      console.log('succesfully search and open stock name');
    }
    const priceData = await page.$$eval('div.css-jw5rjj', (sections) => {
      return sections.map(section => {
        const header = section.querySelector('div.css-bk50lk');
        const isBid = header.querySelector('span:nth-child(2)').textContent === 'Bid';
        const isAsk = header.querySelector('span:first-child').textContent === 'Ask';

        const prices = Array.from(section.querySelectorAll('div:not(.css-bk50lk)'))
          .map(div => div.querySelector('.item-price')?.textContent.trim())
          .filter(Boolean);

        return {
          type: isBid ? 'bid' : isAsk ? 'ask' : 'unknown',
          prices
        };
      });
    })

    // Extract bid and ask prices
    const bidPrices = priceData.find(d => d.type === 'bid')?.prices || [];
    const askPrices = priceData.find(d => d.type === 'ask')?.prices || [];
    console.log('check bid ask bidprice',bidPrices[0]);
    return { bidPrice : bidPrices[0], askPrice : askPrices[0] }
  }  catch (error) {
    console.error('Error in checkbidask:', error);
    return null;
  }
}
async function enterPIN(page) {
  try {
    await clickAndWaitForUrl(page,'/pin');
    await delay(2000);
    const pinAjaibVar1 = await page.$('.pincode-input-container input:nth-of-type(1)');

    // Select the second input element
    const pinAjaibVar2 = await page.$('.pincode-input-container input:nth-of-type(2)');

    // Select the third input element
    const pinAjaibVar3 = await page.$('.pincode-input-container input:nth-of-type(3)');

    // Select the fourth input element
    const pinAjaibVar4 = await page.$('.pincode-input-container input:nth-of-type(4)');
    await pinAjaibVar1.type(process.env.AJ_PIN_1);
    await delay(500);
    await pinAjaibVar2.type(process.env.AJ_PIN_2);
    await delay(500);
    await pinAjaibVar3.type(process.env.AJ_PIN_3);
    await delay(750);
    await pinAjaibVar4.type(process.env.AJ_PIN_4);
    console.log('succesfully enter pin');
  } catch (error){
      console.error('An error occurred:', error.message);
      console.error('Error Stack:', error.stack);
  }
}
async function checkIsThereAnySelector(page, a){
  try{
    let selectorThings= await page.waitForSelector(a, { timeout: 0 });
  } catch(error){
    return false;
  }
  return true;

}
const bersiap= async (page,req,res) => {
    // Go to a website (you can change the URL to your desired site)// Navigate to a website
    console.log('will open link');
    await login(page);
    await delay(5000);
    await enterPIN(page);
    const checkLogout = async (page) => {
      try {
          // Check for a specific element or condition that indicates the user is logged out
          // Example: Check if a login form or a specific logout indicator is visible
          let loginForm= await checkURL(page,'/login'); // Replace with your login form selector
          let pinForm1 = await checkURL(page,'/pin');
          let mengertiForm = await checkIsThereAnySelector(page, selectors.mengertiButton);
          let nantiSajaForm =await checkIsThereAnySelector(page, selectors.nantiSajaGantiPWPopUpButton);

          if (loginForm) {
              // User has been logged out, handle the logout actions here
              console.log('User get logged out');
              await login(page);
          } else if (pinForm1) {
              console.log('Handle PIN');
              await enterPIN(page);
          } else if (mengertiForm){
              console.log("mengerti form on");
              const mengertiButton = await page.$(selectors.mengertiButton);
              if (mengertiButton){
                await mengertiButton.click();
                await delay(2000);
                console.log('clicking mengerti button');
              }
          }else if(nantiSajaForm){
            console.log('nanti saja on');
            await clickByCheckingIsThereClass(page,"css-vq2tl6",selectors.nantiSajaGantiPWPopUpButton);
          }else{
              console.log('check');
          }
          } catch (error) {
              console.error('Error checking logout status:', error);
          }
    };
    console.log('going to set up checkloop')
      // Set up a loop or interval to check for logout periodically (e.g., every 5 seconds)
    const checkLoopa = async () => {
        console.log('check');
        // await checkLogout(page);
        checkLoop=setTimeout(checkLoopa, 15000);
    };
    checkLoopa();
    try {
        await clickAndWaitForUrl(page,'/home');
        await delay(5000);
        await clickByCheckingIsThereClass(page,"css-vq2tl6",selectors.nantiSajaGantiPWPopUpButton);
        while (true) {
            try {
              // Wait for the element to be visible
              const mengertiButton = await page.$(selectors.mengertiButton);
              if (mengertiButton){
                await mengertiButton.click();
                await delay(2000);
                console.log('clicking mengerti button');
              }
              else {
                console.log('Element is no longer visible, stopping clicks.');
                break
              }
        
            } catch (error) {
              // If the element is not found or visible anymore, break the loop
              console.log('Error: Element is no longer visible, stopping clicks.');
              break;
            }
          }
        console.log('succesfully click Mengerti Pop Up');
    } catch (error){
        console.error('An error occurred:', error.message);
        console.error('Error Stack:', error.stack);
    }
    try {
        await clickAndWaitForUrl(page,'/home');
        await delay(1000);
        while (true) {
            try {
              // Wait for the element to be visible
              const mengertiButton = await page.$(selectors.mengertiButton);
              if (mengertiButton){
                await mengertiButton.click();
                await delay(2000);
                console.log('clicking mengerti button');
              }
              else {
                console.log('Element is no longer visible, stopping clicks.');
                break
              }
        
            } catch (error) {
              // If the element is not found or visible anymore, break the loop
              console.log('Error: Element is no longer visible, stopping clicks.');
              break;
            }
          }
        console.log('succesfully click Mengerti Pop Up');
    } catch (error){
        console.error('An error occurred:', error.message);
        console.error('Error Stack:', error.stack);
    }
        // After login and PIN entry, continuously check for logout

  
    res.send('succesfully siapin page');
    
}
const stopLoop = async (res) => {
  try{
    setTimeout(() => {
      clearTimeout(checkLoop);
      clearInterval(checkStopLossTrailStopInterval); 
      console.log("Interval cleared after 5 seconds");
      }, 5000);
    res.send('selesai stop');
  } catch(error){
    console.error(error.message);
  }

}
const solvingpin = async (page,req,res) => {
    await enterPIN(page);
    res.send('selesai enter pin');
}

const buy = async (page,browser, req,res) => {
    // Set headless mode flag (set to 'false' to show the browser)
     // Change to 'true' for headless mode
     console.log('isBuying first',isBuying);
     if (isBuying) {
      return res.status(400).send('A buy operation is already in progress.');
    }
    isBuying=true;
    const stockName = req.query.stockName;
    // Launch Chromium (non-headless mode or headless based on the flag)

    try {
        await page.waitForSelector(selectors.cariAssetSearchBox, { timeout : 10000 });
        await page.$eval(selectors.cariAssetSearchBox, element => element.value='');
        const StockNameInput = await page.$(selectors.cariAssetSearchBox);
        await StockNameInput.type(stockName);
        await delay(2000);
        await clickByClass(page,'css-2b5fr2');
        console.log('succesfully search and open stock name');
    } catch (error){
        console.error('An error occurred:', error.message);
        console.error('Error Stack:', error.stack);
    }
    // const pageHTML = await page.content(); // Get the full HTML of the page
    // console.log('Full HTML of the page:', pageHTML);
    try {
        await clickAndWaitForUrlEvenJustChange(page,'/saham/');
        await delay(3000);
        const beliButtonTab = await page.$(selectors.beliButtonTab);
        await beliButtonTab.click();
        const DayTradeButton= await page.$(selectors.dayTradingButton);
        await DayTradeButton.click();
        
        // const priceText1 = await page.$eval(selectors.inputPriceBox, element => element.textContent || element.value);
        
        // // Parse the price into an integer (e.g., 3780 as number)
        // let priceInt = parseInt(priceText1.replace('.', ''), 10);    
        // // Example gain and loss values (percentage)
        const result = await checkbidask(page, stockName);
        let priceInt = result.askPrice;
        console.log(`start call setgainloss ${priceInt}`);
        console.log(`Price: ${priceInt}`);

        // Calculate adjusted loss and gain
        const { adjusted_loss, adjusted_gain } = setgainloss(priceInt, 1,1);
        console.log(`Adjusted price: ${adjusted_gain}`);
        await page.$eval(selectors.inputPriceBox, element => element.value='');
        const buyPriceInputBox = await page.$(selectors.inputPriceBox);
        const adjustedGain1String= adjusted_gain.toString();
        await buyPriceInputBox.type(adjustedGain1String);
        await delay(2000);
        const dayTrade100Button= await page.$(selectors.dayTrade25PercentBuyingPower);
        await dayTrade100Button.click();
        const BeliButton = await page.$(selectors.BeliButton);
        await BeliButton.click();
        await page.waitForSelector(selectors.beliPopUp);
        const beliPopUpButton = await page.$(selectors.beliPopUp);
        await beliPopUpButton.click();
        console.log('succesfully beli');
    } catch (error){
        console.error('An error occurred:', error.message);
        console.error('Error Stack:', error.stack);
    }
    try {
        await delay(20000);
        let boughtPrice = 0;
        // get the buy price
        const { isSold, price, aksi, stockName2, status } = await checkingRiwayat(page);
        //masih null
        // console.log(`Price: ${price.toString()}`);
        // console.log(`Aksi: ${aksi.toString()}`);
        // console.log(`Status: ${status.toString()}`);
        if(aksi == 'Beli' && isSold){ //aksi == 'Beli' && 
            boughtPrice = price;
        }
        const { adjusted_loss, adjusted_gain } = setgainloss(boughtPrice, 1,1);
        console.log('Stock Name before calling checkstoploss:', stockName);
        const checkStopLossTrailProfit = async (stockName) => {
          const {timeToSell_Profit, timeToSell_Loss}= await checkStopLossTrailStopFunc(page, adjusted_loss, adjusted_gain, stockName); //boolean
          console.log('time to profit ', timeToSell_Profit);
          console.log('time to loss ', timeToSell_Loss);
          if (timeToSell_Profit || timeToSell_Loss) {
            console.log('Stock Name before calling sell:', stockName);
            try{
              await sell(page, stockName);   
            } catch(error){}
            await delay(2000); 
            const { isSold, price, aksi, stockName2, status } = await checkingRiwayat(page);
            if(aksi =='Jual' && isSold){
              console.log('sudah terjual');
              isBuying = false;
              console.log('isBuying after sell',isBuying);
              clearInterval(checkStopLossTrailStopInterval);

            }
          }
        };
        checkStopLossTrailStopInterval = setInterval(() => checkStopLossTrailProfit(stockName), 15000);
        // const checkStopLossInterval = setInterval(() => checkStopLoss(stockName), 5000);
        // const checkTrailProfitInterval = setInterval(() => checkTrailProfit(stockName), 12000);
        // const checkLoop = async () => {
        //   await checkLogout(page);
        //   setTimeout(checkLoop, 30000);
        // };
        // checkLoop();
    } catch (error){
        console.error('An error occurred:', error.message);
        console.error('Error Stack:', error.stack);
    }
    // Close the browser after completion
    // await delay(5000)
    // await browser.close();
    
    try{
    const screenshotBuffer = await page.screenshot();

    // Close the browser
    // await browser.close();

    // Send the screenshot in the response with the appropriate MIME type
    res.set('Content-Type', 'image/png');
    res.send(screenshotBuffer); // Send the screenshot as the response
    } catch (error){
        console.error('An error occurred:', error.message);
        console.error('Error Stack:', error.stack);
    }
    // res.send('Finish');
};
async function checkStopLossTrailStopFunc(page,adjusted_loss_input,adjusted_gain_input, stockName) {
  //cek apakah harga sekarang -1% dari beli
  //get current price (bid)
  const result = await checkbidask(page, stockName);
  if (!result || !result.bidPrice) {
    console.error('❌ Failed to get bid price');
    return {timeToSell_Profit: false , timeToSell_Loss: false};
  }
  const currentBidPrice = parseInt(result.bidPrice.replace(/\./g, ''), 10);
    // Check if price is higher than initial adjusted gain
    if (currentBidPrice >= adjusted_gain_input) {
      // Start trail profit logic
      try {
        await page.waitForSelector('div.css-13j5y24', { timeout: 5000 });
      } catch (error) {
        console.warn('⚠️ Failed to wait for price info:', error);
        return {timeToSell_Profit: false , timeToSell_Loss: false};
      }
  
      // Get latest high price
      const highPrice = await page.evaluate(() => {
        const sections = document.querySelectorAll('div.css-13j5y24');
        for (const section of sections) {
          const spans = section.querySelectorAll('span');
          const label = spans[0]?.innerText.trim().toLowerCase();
          if (label === 'high') {
            const valueText = spans[1]?.innerText.trim();
            if (valueText) {
              return parseInt(valueText.replace(/\./g, ''), 10);
            }
          }
        }
        return null;
      });
  
      if (!highPrice) {
        console.warn('⚠️ High price not found');
        return {timeToSell_Profit: false , timeToSell_Loss: false};
      }
  
      // Recalculate adjusted gain/loss from new high
      const { adjusted_gain, adjusted_loss } = setgainloss(highPrice, 1, 1);
  
      // Decide whether to sell based on trailing loss or maxed-out gain
      const timeToSell_Profit =
        currentBidPrice <= adjusted_loss || (currentBidPrice === adjusted_gain && adjusted_gain < highPrice);
      const timeToSell_Loss = result.bidPrice <= adjusted_loss_input;
      return { timeToSell_Profit , timeToSell_Loss };
    }
  
    // No trail condition met
    return {timeToSell_Profit: false , timeToSell_Loss: false};
}

module.exports = { buy, bersiap , solvingpin , cekRiwayat ,stopLoop };
