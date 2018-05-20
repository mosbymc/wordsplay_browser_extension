window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

var version = 1,
    minGameTime = 120000,
    minGameWords = 1,
    startTime = -1,
    recordedMetrics = false,
    computing = false,
    defaultMetrics = {
        highestScore: 0,
        averageScore: 0,
        lowestScore: 0,
        worstRank: { rank: 0, totalPlayers: 0 },
        bestRank: { rank: 0, totalPlayers: 0 },
        mostGameWords: 0,
        averageWordPoints: 0,
        averageGamePoints: 0,
        averageGameWords: 0,
        averageWordLength: 0,
        averageRankPercentile: 0,
        uniqueWords: [],
        longestWords: [],
        wordsCount: 0,
        gamesPlayed: 0
    },
    defaultMetricsResponse = {
        'b5x5': defaultMetrics,
        'b4x4': defaultMetrics
    },
    bigId = 'b5x5',
    smallId = 'b4x4',
    b5x5Id = 'b5x5',
    b4x4Id = 'b4x4',
    isBig = true;

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
                if (minGameTime <= time) {
                    startTime = time
                    isBig = document.getElementById(smallId).classList.contains('x-hide-display');
                }
            }
        }
    }
    //If the start time hasn't been set yet, then this is the first tick of the timer...
    //thus, regardless of weather the start time meets the minimum amount or not, there's no
    //need to do this work until at least the next tick.
    else {
        if (timerSpan = document.getElementById('ext-gen233')) {
            //if  the timerSpan shows 'Time left:' then we're still in the middle of a game
            if (~timerSpan.innerText.indexOf('Time left:')) {
                //If the start time was recorded for a big board, but the game was changed to the small board before finishing,
                //the reset the start time to be recorded on the next tick and update the 'isBig' flag...
                if (isBig && document.getElementById(b5x5Id).classList.contains('x-hide-display')) {
                    startTime = -1;
                    isBig = false;
                }
                //...do the same thing if the game started out as a small board and is now a big board
                else if (!isBig && document.getElementById(b4x4Id).classList.contains('x-hide-display')) {
                    startTime = -1;
                    isBig = true;
                }
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

    return {
        score: totalPoints,
        wordsCount: words.length,
        longestWords: words.filter(w => w.word.length === longest).map(w => w.word),
        rankings: ranking,
        rankPercentile: ranking.rank / ranking.totalPlayers,
        averageWordPoints: totalPoints / words.length,
        words: words.map(w => w.word),
        charCount: totalChars,
        uniqueWords: uniques
    };
}

function saveGameMetrics(metrics) {
    if (metrics.words.length) {
        let db = window.indexedDB.open("boggle_metrics", version);
        db.onupgradeneeded = function _onUpgradeNeeded(event) {
            event.target.result.createObjectStore("boggle_metrics", { keyPath: 'id', autoIncrement: false });
        };

        db.onsuccess = function _dbOpenSuccess(evt) {
            let store = evt.target.result.transaction(['boggle_metrics'], 'readwrite').objectStore('boggle_metrics'),
                countRequest = store.count();

            countRequest.onsuccess = function _countRequestSuccess() {
                if (countRequest.result > 0) {
                    let metricsRequest = store.get(document.getElementById(b4x4Id).classList.contains('x-hide-display') ? bigId : smallId);

                    metricsRequest.onsuccess = function _metricsUpdateSuccess(evt) {
                        let data = evt.target.result;
                        if (data) {
                            data.highestScore = metrics.score > data.highestScore ? metrics.score : data.highestScore;
                            data.averageScore = ((data.gamesPlayed * data.averageScore) + metrics.score) / (data.gamesPlayed + 1);
                            data.lowestScore = metrics.score < data.lowestScore ? metrics.score : data.lowestScore;

                            if (metrics.rankings.rank > data.worstRank.rank) data.worstRank = metrics.rankings;
                            else if (metrics.rankings.rank === data.worstRank.rank) {
                                if (metrics.rankings.totalPlayers < data.worstRank.totalPlayers) data.worstRank = metrics.worstRank;
                            }
                            if (metrics.rankings.rank < data.bestRank.rank) data.bestRank = metrics.rankings;
                            else if (metrics.rankings.rank === data.bestRank.rank) {
                                if (metrics.rankings.totalPlayers > data.bestRank.totalPlayers) data.bestRank = metrics.rankings;
                            }

                            data.mostGameWords = metrics.words.length > data.mostGameWords ? metrics.words.length : data.mostGameWords;
                            data.averageWordPoints = ((data.wordsCount * data.averageWordPoints) + metrics.score) / (data.wordsCount + metrics.words.length);
                            data.averageGamePoints = ((data.wordsCount + metrics.words.length) * data.averageWordPoints) / (data.gamesPlayed + 1);
                            data.averageGameWords = (data.wordsCount + metrics.words.length) / (data.gamesPlayed + 1);

                            data.averageRankPercentile = ((data.gamesPlayed * data.averageRankPercentile) + metrics.rankPercentile) / (data.gamesPlayed + 1);
                            data.averageWordLength = ((data.averageWordLength * data.wordsCount) + metrics.charCount) / (data.wordsCount + metrics.words.length);
                            data.uniqueWords = unionWords(data.uniqueWords, metrics.uniqueWords);

                            if (metrics.longestWords[0].length > data.longestWords[0].length) data.longestWords = metrics.longestWords;
                            else if (metrics.longestWords[0].length === data.longestWords[0].length) data.longestWords = unionWords(data.longestWords, metrics.longestWords);

                            data.gamesPlayed += 1;
                            data.wordsCount = data.wordsCount + metrics.words.length;
                            store.put(data);
                        }
                        else createNewBoardEntry(store, metrics);
                    };

                    metricsRequest.onerror = err => console.error('Unable to retrieve existing boggle metrics: ', err);
                }
                else {
                    createNewBoardEntry(store, metrics);
                }
            };
        };

        db.onerror = err => console.error('Unable to access IndexedDB: ', err);
    }
}

function createNewBoardEntry(store, metrics) {
    store.add({
        id: document.getElementById(b4x4Id).classList.contains('x-hide-display') ? bigId : smallId,//metrics.id,
        highestScore: metrics.score,
        averageScore: metrics.score,
        lowestScore: metrics.score,
        worstRank: metrics.rankings,
        bestRank: metrics.rankings,
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
        let store = evt.target.result.transaction('boggle_metrics').objectStore('boggle_metrics'),
            countRequest = store.count();

        countRequest.onsuccess = function _countRequestSuccess() {
            if (0 < countRequest.result) {
                let data = {};
                store.openCursor().onsuccess = function _cursorSuccess(e) {
                    var cursor = e.target.result;
                    if (cursor) {
                        data[cursor.value.id] = cursor.value;
                        cursor.continue();
                    }
                    else {
                        if (!('b5x5' in data)) data['b5x5'] = defaultMetrics;
                        if (!('b4x4' in data)) data['b4x4'] = defaultMetrics;
                        cb(data);
                    }
                };
            }

            else cb(defaultMetricsResponse);
        };
    };

    db.onerror = () => cb(defaultMetricsResponse);
}

chrome.runtime.onMessage.addListener(
    function _messageHandler(request, sender, sendResponse) {
        if ('get_metrics' === request.action) {
            getGameMetrics(sendResponse);
            return true;
        }
    }
);

chrome.storage.sync.get(['min_time'], function _storageRequestCallback(result) {
    minGameTime = result && result.min_time ? result.min_time * 1000 : minGameTime;
});

chrome.storage.sync.get(['min_words'], function _storageRequestCallback(result) {
    minGameWords = result && result.min_words ? result.min_words : minGameWords;
});