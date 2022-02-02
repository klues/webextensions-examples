setInterval(checkHomeoffice, 2000);
let contentDiv = null;
let contentDivId = "hoPluginContentDiv";
if (!localStorage.getItem('hoursPerDay')) {
    localStorage.setItem('hoursPerDay', 7.7);
}

let contentHTML = '';
let lastContentHTML = '';

function checkHomeoffice() {
    let content = document.getElementById("content");
    let table = content && content.contentWindow ? content.contentWindow.document.getElementById("t1") : null;
    if (table) {
        contentDiv = content.contentWindow.document.getElementById(contentDivId);
        if(!contentDiv) {
            contentDiv = document.createElement("div");
            contentDiv.id = contentDivId;
            table.insertAdjacentElement('beforebegin', contentDiv);
            lastContentHTML = "";
        }
        contentHTML = "";
        print();
        contentHTML += `
            <label for="inHoursPerDay">Stunden pro Woche: </label>
            <input id="inHoursPerDay" type="number" min="1" max="10" step="0.1" value="${localStorage.getItem('hoursPerDay')}" onchange="localStorage.setItem('hoursPerDay', parseFloat(event.target.value))"/><br/>
        `;

        let rows = [];
        let domRows = Array.from(table.getElementsByTagName("tr"));
        for (let i = 0; i < domRows.length; i++) {
            let domRow = domRows[i];
            let newRow = {};
            if (domRow.children[8]) {
                newRow.dauerStr = domRow.children[8].innerHTML;
                newRow.aktivitaet = domRow.children[5].innerHTML;
                newRow.oe = domRow.children[4].innerHTML;
                newRow.ap = domRow.children[3].innerHTML;
                newRow.projekt = domRow.children[2].innerHTML;
                let hours = parseInt(newRow.dauerStr.substr(0,2));
                let minutes = parseInt(newRow.dauerStr.substr(3,2));
                newRow.minutes = hours * 60 + minutes;
                rows.push(newRow);
            }
            if(domRow.id && domRow.id.startsWith('tag_row')) {
                let date = {
                    day: parseInt(domRow.id.substr(8,2)),
                    month: parseInt(domRow.id.substr(11,2)),
                    year: parseInt(domRow.id.substr(14,4))
                }
                date.week = getWeek(date.year, date.month, date.day);
                rows.forEach(row => {
                    if (!row.date) {
                        row.date = date;
                        row.dateStr = domRow.id.substring(8)
                    }
                });
                let child1 = domRow.childNodes[0];
                let child2 = child1 ? child1.childNodes[1] : null;
                if (child2 && child2.innerHTML) {
                    let additionalRow = {};
                    additionalRow.aktivitaet = '';
                    additionalRow.minutes = 0;
                    additionalRow.ganzTagAbwesenheit = child2.innerHTML;
                    additionalRow.date = date;
                    additionalRow.dateStr = domRow.id.substring(8);
                    rows.push(additionalRow);
                }
            }

        }

        rows = rows.filter(row => row.date && (row.minutes || row.ganzTagAbwesenheit));
        let rowsMonth = {};
        let rowsWeek = {};
        let rowsArbeit = {};
        rows.forEach(row => {
            rowsMonth[row.date.month] = rowsMonth[row.date.month] || [];
            rowsWeek[row.date.week] = rowsWeek[row.date.week] || [];
            rowsMonth[row.date.month].push(row);
            rowsWeek[row.date.week].push(row);
            let arbeitKey = (row.projekt || '') + (row.ap || '') + (row.aktivitaet || '') + (row.oe || '') + "";
            arbeitKey = arbeitKey.replaceAll(" - Homeoffice", "").replaceAll(" ", "").trim();
            if (arbeitKey && arbeitKey !== "NaN" && !arbeitKey.includes("Pause")) {
                rowsArbeit[arbeitKey] = rowsArbeit[arbeitKey] || [];
                rowsArbeit[arbeitKey].push(row);
            }
        });
        print();
        let monatKey1 = new Date().getMonth() + 1;
        let monthKey2 = monatKey1 > 1 ? monatKey1 - 1 : 12;
        calc(rowsMonth, [monatKey1, monthKey2], "Monat: ");
        print();
        //calc(rowsWeek, "Woche: ");
        //print("------------");
        calcArbeit(rowsArbeit, "Arbeit: ");
        print();
    }
    if (contentHTML !== lastContentHTML) {
        contentDiv.innerHTML = contentHTML;
        lastContentHTML = contentHTML;
    }
}

function print(text) {
    text = text || '';
    //console.log(text);
    contentHTML += text + "<br/>";
}

function printBalken(values, colors, texts, startText, marker) {
    let html = '';
    texts = texts || [];
    if(startText) {
        html += `<div style="display:inline-block; width: 5%">${startText}</div>`;
    }
    values.forEach((value, index) => {
        let text = texts[index] || '';
        html += `<div style="display:inline-block; text-overflow: clip; overflow: hidden; width: ${value* 0.85}%; height: 15px; background-color: ${colors[index]}; border: 1px solid black" title="${text}">${text}</div>`
    });
    if (marker) {
        html += `<div style="display:inline-block; position: absolute; left: 0; top:-10px; z-index: -1; width: ${marker * 0.85}%; height: 35px; border-right: 2px solid red"></div>`
    }
    html = `<div style="position: relative">${html}</div>`;
    contentHTML += html;
}

function calc(object, keys, text) {
    keys.forEach(key => {
        let rows = object[key];
        let sumAnwesend = 0;
        let sumHO = 0;
        rows.forEach(row => {
            let isPause = row.aktivitaet.includes('Pause');
            let isGanztagAbwesend = !!row.ganzTagAbwesenheit;
            if(!isPause && !isGanztagAbwesend && row.aktivitaet.includes("Homeoffice")) {
                sumHO += row.minutes;
            } else if(!isPause && !isGanztagAbwesend && !row.aktivitaet.includes("Homeoffice")) {
                sumAnwesend += row.minutes;
            } else if (isGanztagAbwesend) {
                let hoursPerDay = parseFloat(localStorage.getItem('hoursPerDay'));
                if (row.ganzTagAbwesenheit.includes("ZA")) {
                    sumAnwesend += hoursPerDay * 60;
                } else if (row.ganzTagAbwesenheit.includes("Urlaub")) {
                    sumAnwesend += hoursPerDay * 60;
                }
            }
        });
        let total = sumHO + sumAnwesend;
        let percentageHO = Math.round(sumHO/total*100);
        let percentageAnwesend = Math.round(sumAnwesend/total*100);
        //let printText = `${text}${key} -> HO: ${percentageHO}%, Anwesend: ${percentageAnwesend}%`;
        //print(printText);
        let texts = [`HO: ${percentageHO}%`, `A: ${percentageAnwesend}%`]
        printBalken([percentageHO, percentageAnwesend], ['orange', 'lightblue'], texts, `Monat ${key}: `, 40);
    })
}

function calcArbeit(object, text) {
    let sums = {};
    let totalSum = 0;
    Object.keys(object).forEach(key => {
        let rows = object[key];
        sums[key] = 0;
        rows.forEach(row => {
            let isPause = row.aktivitaet.includes('Pause');
            let isGanztagAbwesend = !!row.ganzTagAbwesenheit;
            if (!isPause && !isGanztagAbwesend) {
                sums[key] += row.minutes;
                totalSum += row.minutes;
            }
        });
    });
    let values = [];
    let texts = [];
    let keys = Object.keys(object).sort();
    keys.forEach(key => {
        //print(`${key} -> ${Math.round(sums[key])} -> ${Math.round(sums[key]/totalSum*100)}%`)
        let value = Math.round(sums[key]/totalSum*100);
        texts.push(`${key}: ${value}%`);
        values.push(value);
    });
    printBalken(values, ['lightgreen', 'lightcyan', 'lightpink', 'gold', 'beige', 'lightgray', 'yellow'], texts, 'Arbeit: ');
}

function getWeek(year, month, day) {
    function serial(days) {
        return 86400000 * days;
    }

    function dateserial(year, month, day) {
        return (new Date(year, month - 1, day).valueOf());
    }

    function weekday(date) {
        return (new Date(date)).getDay() + 1;
    }

    function yearserial(date) {
        return (new Date(date)).getFullYear();
    }

    let date = year instanceof Date ? year.valueOf() : typeof year === "string" ? new Date(year).valueOf() : dateserial(year, month, day),
        date2 = dateserial(yearserial(date - serial(weekday(date - serial(1))) + serial(4)), 1, 3);
    return ~~((date - date2 + serial(weekday(date2) + 5)) / serial(7));
}
