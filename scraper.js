const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

async function fetchHTML(url) {
    try {
        const { data } = await axios.get(url);
        return data;
    } catch (error) {
        console.error(`Error fetching the URL: ${error}`);
        return null;
    }
}

async function scrapeMatches(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Wait for the table to be loaded
    await page.waitForSelector('#DataTables_Table_0');

    const data = await page.evaluate(() => {
        const table = document.querySelector('#DataTables_Table_0');
        if (!table) return { headers: [], rows: [] };

        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
        const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => {
            return Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
        });

        return { headers, rows };
    });

    await browser.close();
    return data;
}

function convertToCSV(headers, rows) {
    const csvRows = [];
    csvRows.push(headers.join(','));

    rows.forEach(row => {
        csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
}

function saveCSV(filename, csv, append = false) {
    const fullPath = path.join(__dirname, filename);
    if (append) {
        fs.appendFileSync(fullPath, '\n' + csv);
    } else {
        fs.writeFileSync(fullPath, csv);
    }
}

function readCSV(filename) {
    const fullPath = path.join(__dirname, filename);
    return new Promise((resolve, reject) => {
        const rows = [];
        fs.createReadStream(fullPath)
            .pipe(csv())
            .on('data', (data) => rows.push(data))
            .on('end', () => {
                resolve(rows);
            })
            .on('error', (error) => reject(error));
    });
}

(async () => {
    const url = 'https://www.bjjheroes.com/bjj-fighters/giancarlo-bodoni';
    const { headers, rows } = await scrapeMatches(url);

    if (headers.length && rows.length) {
        const csvData = convertToCSV(headers, rows);
        const existingCSV = 'matches.csv';

        // Check if the file exists and append data
        if (fs.existsSync(existingCSV)) {
            saveCSV(existingCSV, csvData, true);
        } else {
            saveCSV(existingCSV, csvData);
        }

        console.log('Data has been added to matches.csv');
    } else {
        console.log('No data found to save.');
    }
})();
