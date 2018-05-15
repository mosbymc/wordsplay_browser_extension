var version = 2;
var boggleDB;

// In the following line, you should include the prefixes of implementations you want to test.
window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
// DON'T use "var indexedDB = ..." if you're not in a function.
// Moreover, you may need references to some window.IDB* objects:
window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
// (Mozilla has never prefixed these objects, so we don't need window.mozIDB*)

// Let us open version 4 of our database
var request = window.indexedDB.open("boggle_metrics", version);

// these two event handlers act on the database being opened successfully, or not
request.onerror = function _onError(event) {};

request.onsuccess = function _onSuccess(event) {
    // store the result of opening the database in the db variable. This is used a lot later on, for opening transactions and suchlike.
    //boggleDB = fromNullable(request.result);
    let objectStore = event.target.result.transaction(['boggle_metrics'], 'readwrite');
    var t = objectStore.objectStore('boggle_metrics');
    var flag = false;

    let countRequest = t.count();

    countRequest.onsuccess = function _success() {
        if (countRequest.result > 0) {
            let metricsRequest = t.get(1);

            metricsRequest.onsuccess = function _success(evt) {
                flag = true;
                let data = evt.target.result;
                data.highestScore += 1;
                data.averageScore = 1;
                data.highestRank = 1;
                data.lowestRank = 1;
                data.mostGameWords = 1;
                data.averageWordPoints = 1;
                data.averageGameWords = 1;
                data.averageRankPercentile = 1;
                data.bestRank = 1;
                data.uniqueWords = [];
                data.gamesPlayed = 1;
                data.wordsCount = 1;

                let updateRequest = t.put(data);
            };
        }
        else {
            t.add({
                id: 1,
                highestScore: 1,
                lowestScore: 1,
                highestRank: 1,
                lowestRank: 1,
                mostGameWords: 1,
                averageWordPoints: 1,
                averageRankPercentile: 1,
                bestRank: 1,
                uniqueWords: 1,
                longestWords: 1,
                wordsCount: 1,
                gamesPlayed: 1
            });
        }
    };
};

request.onupgradeneeded = function _onUpgradeNeeded(event) {
    var db = event.target.result;
    db.deleteObjectStore('boggle_metrics');
    db.deleteObjectStore('boggle_words');

    // Create an objectStore for this database
    var metrics = db.createObjectStore("boggle_metrics", { keyPath: 'id', autoIncrement: false });
    var words = db.createObjectStore("boggle_words", { keyPath: 'id', autoIncrement: false });
};

/**
 * Metrics:
 * - Highest Score
 * - Average Score
 * - Games Played
 * - Longest Word
 * - Average Rank
 * - Highest Rank
 * - Lowest Rank
 * - Average Word Length
 * - Average Word Points
 * - Most Words in a Game
 * - Average Number of Words
 */

/**
 * Personal game data is stored in the globally available "d_" variable: d_.boards["game_id"]
 * Will need to split the words available in the board to transform into an array and then find the words in the array based on the words guessed
 * Score is provided on each game under "d_.boards"
 *
 * Ideally, I will find an event that I can listen to that signals the end of a round... also the beginning so I can implement a "timeout" feature to stop
 * counting the current game if the player goes "inactive"
 *
 * Will need a "content script" (https://developer.chrome.com/extensions/content_scripts) in order to gather data from wordsplay.net +
 * a background.html page in order to display the metrics.
 */

var minGameTime = 120000,
    startTime = -1,
    recordedMetrics = false;

setInterval(function _gameMonitor() {
    let timerSpan;
    if (-1 === startTime) {
        if (timerSpan = document.getElementById('ext-gen233')) {
            let splits = timerSpan.innerText.split(':');
            if (splits[0] === 'Time Left') {
                let time = (Number.parseInt(splits[1]) * 60000) + (Number.parseInt(splits[2]) * 1000);
                //If the minGameTime is not equal to or less than the current time remaining,
                //then don't bother setting the 'startTime' variable - we'll just skip including
                //this game's results and start recording data on the next game
                if (minGameTime <= time) {
                    startTime = time
                }
            }
        }
    }
    //If the start time hasn't been set yet, then this is the first tick of the timer...
    //thus, regardless of weather the start time meets the minimum amount or not, there's no
    //need to do this work until atleast the next tick.
    else {
        if (timerSpan = document.getElementById('ext-gen233')) {
            //if  the timerSpan shows 'Time left:' then wer're still in the middle of a game
            if (timerSpan.innerText.indexOf('Time Left:')) {
                recordedMetrics = false;
                return;
            }

            //if the timerSpan shows 'Loading...' then we have to wait for the scores to be displayed before gathering the data
            if (timerSpan.innerText.indexOf('Loading...')) return;

            //otherwise, the game has stopped and we can gather the data as long as we haven't already gathered it
            if (!recordedMetrics) {
                saveGameMetrics(computeMetrics(getGameWords(), getUniqueWords(), getGameRank()));
                recordedMetrics = true;
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
    let rank = Array.prototype.concat.apply([], Array.from(document.querySelectorAll('.me'))
            .map(div => Array.from(div.querySelectorAll('.x-grid3-cell-inner'))))[0].innerText,
        totalPlayers = Array.from(document.getElementById('ext-gen493').querySelectorAll('.x-grid3-row'));

    return {
        rank: Number.parseInt(rank),
        totalPlayers: Number.parseInt(totalPlayers[totalPlayers.length - 1].querySelectorAll('.x-grid3-cell-inner')[0].innerText)
    };
}

function getUniqueWords() {
    return Array.from(document.getElementById('ext-gen272')
        .querySelectorAll('.fb_only'))
        .map(div => div.innerText);
}

function computeMetrics(words, uniques, ranking) {
    let longest = 0,
        totalPoints = 0;

    words.forEach(function _findLongestWord(w) {
        if (w.word.length > longest) longest = w.word.length;
    });

    words.map(word => word.points).forEach(point => totalPoints += point);

    return Object.create(boggleMetrics, {
        score: { value: totalPoints },
        wordsCount: { value: words.length },
        longestWords: { value: words.filter(w => w.word.length === longest).map(w => w[0]) },
        rank: { value: ranking.rank },
        rankPercentile: { value: ranking.rank / ranking.totalPlayers },
        averageWordPoints: { value: totalPoints / words.length },
        words: { value: words.map(word => word.word) },
        uniqueWords: { value: uniques }
    });
}

function saveGameMetrics(metrics) {
    let db = window.indexedDB.open("boggle_metrics", version);
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
                    data.highestRank = metrics.rank > data.highestRank ? metrics.rank : data.highestRank;
                    data.lowestRank = metrics.rank < data.lowestRank ? metrics.rank : data.lowestRank;
                    data.mostGameWords = metrics.words.length > data.mostGameWords ? metrics.words.length : data.mostGameWords;
                    data.averageWordPoints = ((data.wordsCount * data.averageWordPoints) + metrics.points) / (data.wordsCount + metrics.words.length);
                    data.averageGameWords = ((data.wordsCount * data.gamesPlayed) + metrics.words.length) / (data.gamesPlayed + 1);
                    data.averageRankPercentile = ((data.gamesPlayed * data.averageRankPercentile) + metrics.rankPercentile) / (data.gamesPlayed + 1);
                    data.uniqueWords = unionWords(data.uniqueWords, metrics.uniqueWords);

                    if (metrics.longestWords[0].length > data.longestWords[0].length) {
                        data.longestWords = metrics.longestWords;
                    }
                    else if (metrics.longestWords[0].length === data.longestWords[0].length) {
                        data.longestWords = unionWords(data.longestWords, metrics.longestWords);
                    }

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
                    lowestScore: metrics.score,
                    highestRank: metrics.rank,
                    lowestRank: metrics.rank,
                    mostGameWords: metrics.words.length,
                    averageWordPoints: metrics.averageWordPoints,
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

function unionWords(currentUniques, newUniques) {
    let res = currentUniques;
    for (let word of newUniques) {
        if (!res.contains(word)) res.push(word);
    }
    return res;
}

var boggleMetrics = {
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

function getGameMetrics(cb) {
    let db = window.indexedDB.open("boggle_metrics", version);
    db.onsuccess = function _dbOpenSuccess(evt) {
        let store = evt.target.result.transaction(['boggle_metrics'], 'readwrite').objectStore('boggle_metrics'),
            countRequest = store.count();

        countRequest.onsuccess = function _countRequestSuccess() {
            if (countRequest.result > 0) {
                let metricsRequest = store.get(1);

                metricsRequest.onsuccess = evt => cv(evt.target.result);
                metricsRequest.onerror = () => cb(null);
            }
            else {
                cb(null);
            }
        };
    };

    db.onerror = () => cb(null);
}


chrome.runtime.onMessage.addListener(
    function _messageHandler(request, sender, sendResponse) {
        if ('get_metrics' === request.action) {
            getGameMetrics(sendResponse);
        }
    }
);