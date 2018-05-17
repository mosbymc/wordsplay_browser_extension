var version = 1;

window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

/**
 * Metrics:
 * - Games Played
 * - Highest Score
 * - Average Score
 * - Lowest Score
 * - Highest Rank
 * - Lowest Rank
 * - Average Rank Percentile
 * - Most Words in a Game
 * - Average Number of Words in a Game
 * - Average Number of Points in a Game
 * - Average Word Length
 * - Average Word Points
 * - Average Words in a Game
 * - Longest Words
 * - Unique Words
 */

/**
 * Will need a "content script" (https://developer.chrome.com/extensions/content_scripts) in order to gather data from wordsplay.net +
 * a background.html page in order to display the metrics.
 */

var minGameTime = 120000,
    startTime = -1,
    recordedMetrics = false,
    computing = false,
    boggleMetrics = {
        id: 1,
        score: 0,
        wordsCount: 0,
        longestWords: [],
        uniqueWords: [],
        rankPercentile: 100,
        averageWordPoints: 0,
        words: 0,
        rank: 0
    };

setInterval(function _gameMonitor() {
    let timerSpan;
    if (-1 === startTime) {
        if (timerSpan = document.getElementById('ext-gen233')) {
            let splits = timerSpan.innerText.split(':');
            if (splits[0] === 'Time left') {
                let time = (Number.parseInt(splits[1]) * 60000) + (Number.parseInt(splits[2]) * 1000);
                //If the minGameTime is not equal to or less than the current time remaining,
                //then don't bother setting the 'startTime' variable - we'll just skip including
                //this game's results and start recording data on the next game
                if (minGameTime <= time) startTime = time
            }
        }
    }
    //If the start time hasn't been set yet, then this is the first tick of the timer...
    //thus, regardless of weather the start time meets the minimum amount or not, there's no
    //need to do this work until atleast the next tick.
    else {
        if (timerSpan = document.getElementById('ext-gen233')) {
            //if  the timerSpan shows 'Time left:' then wer're still in the middle of a game
            if (~timerSpan.innerText.indexOf('Time left:')) {
                recordedMetrics = false;
                return;
            }

            //if the timerSpan shows 'Loading...' then we have to wait for the scores to be displayed before gathering the data
            if (~timerSpan.innerText.indexOf('Loading...')) return;

            //otherwise, the game has stopped and we can gather the data as long as we haven't already gathered it
            if (~timerSpan.innerText.indexOf('New game')) {
                if (!recordedMetrics && startTime - minGameTime >= 0 !== startTime && !computing) {
                    computing = true;
                    saveGameMetrics(computeMetrics(getGameWords(), getUniqueWords(), getGameRank()));
                    recordedMetrics = true;
                    startTime = -1;
                    computing = false;
                }
            }
        }
    }
}, 5);

function getGameWords() {
    let wordDiv = document.getElementById('ext-gen342');
    return wordDiv ? Array.from(wordDiv.querySelectorAll('span'))
        .filter(span => span.classList.contains('word'))
        .filter(span => !span.parentNode.classList.contains('bad'))
        .map(function _getSpanInfo(span) {
            let data = span.innerText.split(':');
            return {
                word: data[0],
                points: data.length > 1 ? Number.parseInt(data[1]) : 1
            };
        }) : [];
}

function getGameRank() {
    try {
        let rank = Array.prototype.concat.apply([], Array.from(document.querySelectorAll('.me'))
                .map(div => Array.from(div.querySelectorAll('.x-grid3-cell-inner'))))[0].innerText,
            totalPlayers = Array.from(document.getElementById('ext-gen493').querySelectorAll('.x-grid3-row'));

        return {
            rank: Number.parseInt(rank),
            totalPlayers: Number.parseInt(totalPlayers[totalPlayers.length - 1].querySelectorAll('.x-grid3-cell-inner')[0].innerText)
        };
    }
        //If the player guess no words, then there is no span with a 'me' class, so the attempt to get the innerText will throw.
        //Since we don't record games with no points anyway, we just return a dummy object here - it won't be recorded
    catch(e) {
        return { rank: 0, totalPlayers: 0 };
    }
}

function getUniqueWords() {
    return Array.from(document.getElementById('ext-gen272')
        .querySelectorAll('.fb_only'))
        .map(div => div.innerText);
}

function computeMetrics(words, uniques, ranking) {
    let longest = 0,
        totalPoints = 0,
        totalChars = 0;

    words.forEach(function _findLongestWord(w) {
        if (w.word.length > longest) longest = w.word.length;
        totalChars += w.word.length;
    });

    words.map(word => word.points).forEach(point => totalPoints += point);

    return Object.create(boggleMetrics, {
        score: { value: totalPoints },
        wordsCount: { value: words.length },
        longestWords: { value: words.filter(w => w.word.length === longest).map(w => w.word) },
        rank: { value: ranking.rank },
        rankPercentile: { value: ranking.rank / ranking.totalPlayers },
        averageWordPoints: { value: totalPoints / words.length },
        words: { value: words.map(word => word.word) },
        charCount: { value: totalChars },
        uniqueWords: { value: uniques }
    });
}

function saveGameMetrics(metrics) {
    if (metrics.words.length) {
        let db = window.indexedDB.open("boggle_metrics", version);
        db.onupgradeneeded = function _onUpgradeNeeded(event) {
            // Create an objectStore for this database
            event.target.result.createObjectStore("boggle_metrics", { keyPath: 'id', autoIncrement: false });
        };

        db.onsuccess = function _dbOpenSuccess(evt) {
            let store = evt.target.result.transaction(['boggle_metrics'], 'readwrite').objectStore('boggle_metrics'),
                countRequest = store.count();

            countRequest.onsuccess = function _countRequestSuccess() {
                if (countRequest.result > 0) {
                    let metricsRequest = store.get(1);

                    metricsRequest.onsuccess = function _metricsUpdateSuccess(evt) {
                        let data = evt.target.result;
                        data.highestScore = metrics.score > data.highestScore ? metrics.score : data.highestScore;
                        data.averageScore = ((data.gamesPlayed * data.averageScore) + metrics.score) / (data.gamesPlayed + 1);
                        data.lowestScore = metrics.score < data.lowestScore ? metrics.score : data.lowestScore;
                        data.highestRank = metrics.rank > data.highestRank ? metrics.rank : data.highestRank;
                        data.lowestRank = metrics.rank < data.lowestRank ? metrics.rank : data.lowestRank;
                        data.mostGameWords = metrics.words.length > data.mostGameWords ? metrics.words.length : data.mostGameWords;
                        data.averageWordPoints = ((data.wordsCount * data.averageWordPoints) + metrics.score) / (data.wordsCount + metrics.words.length);
                        data.averageGamePoints = ((data.wordsCount + metrics.words.length) * data.averageWordPoints) / (data.gamesPlayed);
                        data.averageGameWords = (data.wordsCount + metrics.words.length) / (data.gamesPlayed + 1);
                        data.averageRankPercentile = ((data.gamesPlayed * data.averageRankPercentile) + metrics.rankPercentile) / (data.gamesPlayed + 1);
                        data.averageWordLength = ((data.averageWordLength * data.wordsCount) + metrics.charCount) / (data.wordsCount + metrics.words.length);
                        data.uniqueWords = unionWords(data.uniqueWords, metrics.uniqueWords);

                        if (metrics.longestWords[0].length > data.longestWords[0].length) data.longestWords = metrics.longestWords;
                        else if (metrics.longestWords[0].length === data.longestWords[0].length) data.longestWords = unionWords(data.longestWords, metrics.longestWords);

                        data.gamesPlayed += 1;
                        data.wordsCount = data.wordsCount + metrics.words.length;
                        store.put(data);
                    };

                    metricsRequest.onerror = err => console.error('Unable to retrieve existing boggle metrics: ', err);
                }
                else {
                    store.add({
                        id: metrics.id,
                        highestScore: metrics.score,
                        averageScore: metrics.score,
                        lowestScore: metrics.score,
                        highestRank: metrics.rank,
                        lowestRank: metrics.rank,
                        mostGameWords: metrics.words.length,
                        averageWordPoints: metrics.averageWordPoints,
                        averageGamePoints: metrics.score,
                        averageGameWords: metrics.words.length,
                        averageWordLength: metrics.charCount / metrics.words.length,
                        averageRankPercentile: metrics.rankPercentile,
                        uniqueWords: metrics.uniqueWords,
                        longestWords: metrics.longestWords,
                        wordsCount: metrics.words.length,
                        gamesPlayed: 1
                    });
                }
            };
        };

        db.onerror = err => console.error('Unable to access IndexedDB: ', err);
    }
}

function unionWords(currentUniques, newUniques) {
    let res = currentUniques;
    for (let word of newUniques) {
        if (!res.includes(word)) res.push(word);
    }
    return res;
}

function getGameMetrics(cb) {
    let db = window.indexedDB.open("boggle_metrics", version);
    db.onsuccess = function _dbOpenSuccess(evt) {
        let store = evt.target.result.transaction(['boggle_metrics'], 'readwrite').objectStore('boggle_metrics'),
            countRequest = store.count();

        countRequest.onsuccess = function _countRequestSuccess() {
            if (countRequest.result > 0) {
                let metricsRequest = store.get(1);

                metricsRequest.onsuccess = function _success(evt) {
                    cb(evt.target.result);
                };
                metricsRequest.onerror = () => cb(null);
            }
            else cb(null);
        };
    };

    db.onerror = () => cb(null);
}

chrome.runtime.onMessage.addListener(
    function _messageHandler(request, sender, sendResponse) {
        if ('get_metrics' === request.action) {
            getGameMetrics(sendResponse);
            return true;
        }
    }
);