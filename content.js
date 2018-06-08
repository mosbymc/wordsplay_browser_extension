window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

var extension;  //save the vendor-specific extension namespace to a variable so this extension can be cross platform

try {
    //For some reason, both Edge and Chrome will throw when testing like so: 'chrome && chrome.runtime...' if
    //the variable does not exist within scope. I've never seen behavior like this before and according to spec
    //it shouldn't throw. So instead I am using 'typeof' as a workaround to prevent the exception
    extension = 'undefined' !== typeof chrome && chrome.runtime ? chrome : browser;
}
catch(e) {
    console.log('Unable to record metrics: Vendor specific extension namespace unknown.');
}

var version = 1,                    //db version number
    minGameTime = 120000,           //default min game time if not set in google storage from options page
    minGameWords = 1,               //default min game words if not set in google storage from options page
    startTime = -1,                 //stores the start time of the current game to be compared to the minGameTime var during recording
    recordedMetrics = false,        //prevents the game from recording the same metrics more than once
    computing = false,              //prevents the game from computing the metrics more than once due to the game loop
    defaultMetrics = {              //default metrics object - used when metrics are requested for the popup if none exist
        highestScore: 0,
        averageScore: 0,
        bestRank: { rank: 0, totalPlayers: 0 },
        mostGameWords: 0,
        averageWordPoints: 0,
        averageGamePoints: 0,
        averageGameWords: 0,
        averageWordLength: 0,
        bestRankPercentile: 1,
        averageRankPercentile: 1,
        uniqueWords: [],
        longestWords: [],
        teamBestRank: { rank: 0, teamCount: 0, totalPlayers: 0 },
        teamBestRankPercentile: 1,
        teamAverageRankPercentile: 1,
        teamHighestScore: 0,
        teamAverageScore: 0,
        teamAverageScorePerPlayer: 0,
        teamAverageScoreContributionPercent: 0,
        teamGamesPlayed: 0,
        wordsCount: 0,
        gamesPlayed: 0
    },
    b5x5Id = 'b5x5',                //id for the DOM's 5x5 game board and IDB storage entry
    b4x4Id = 'b4x4',                //id for the DOM's 4x4 game board and IDB storage entry
    isBig = true;                   //indicates if the recorded start time was for a small or large board - prevent errors in recording if board size is
                                    //switched mid-game

function noop() {}

//Metrics loop - fires every 5 seconds to check game start time and record metrics if the minimum time and words have been met
//and the scores have been posted
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
                    startTime = time;
                    isBig = document.getElementById(b4x4Id).classList.contains('x-hide-display');
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

            //If the timerSpan shows 'New game', the game has stopped and we can gather the data as long as we haven't already gathered it
            if (~timerSpan.innerText.indexOf('New game')) {
                if (!recordedMetrics && startTime - minGameTime >= 0 !== startTime && !computing) {
                    computing = true;   //set the computing var to 'true', if the computations take more than 5 second (unlikely), then we won't
                                        //try to record them again while the first is still computing
                    saveGameMetrics(computeMetrics(getGameWords(), getUniqueWords(), getGameRank(), getTeamMetrics()));
                    recordedMetrics = true;
                    startTime = -1;     //set the startTime var back to -1 for the next game
                    computing = false;  //set computing var back to 'false' for the next game
                }
            }
        }
    }
}, 5);

//Retrieves the legit words guessed by the player and returns an array of objects that contain
//a word and its point value
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

//Retrieves the player's game rank and the total number of players in the game
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
        //If the player guessed no words, then there is no span with a 'me' class, so the attempt to get the innerText will throw.
        //Since we don't record games with no points anyway, we just return a dummy object here - it won't be recorded
    catch(e) {
        return { rank: 0, totalPlayers: 0 };
    }
}

//Gets all the unique words guessed by the player during the game
function getUniqueWords() {
    return Array.from(document.getElementById('ext-gen272')
        .querySelectorAll('.fb_only'))
        .map(div => div.innerText);
}

function getTeamMetrics() {
    try {
        let names = document.querySelectorAll('.me')[0].querySelectorAll('.x-grid3-col-name')[0].innerText.trim().split(':');

        if (1 < names.length) {
            let teamName = names[0],
                playerName = names[1],
                recordedTeam = false,
                teamRank, teamScore, teamCount = 0;

            Array.from(document.getElementById('ext-gen493').querySelectorAll('.x-grid3-col-name'))
                .forEach(function _findTeam(playerDiv) {
                    if (playerDiv.innerText.includes(teamName) && !playerDiv.innerText.includes(playerName) && !recordedTeam) {
                        teamRank = Number.parseInt(playerDiv.parentElement.parentElement.querySelectorAll('.x-grid3-cell-inner')[0].innerText);
                        teamScore = Number.parseInt(playerDiv.parentElement.parentElement.querySelectorAll('.x-grid3-cell-last')[0].innerText);
                        recordedTeam = true;
                    }
                    else if (playerDiv.innerText.includes(teamName)) teamCount++;
                });

            if (teamRank) return { rank: teamRank, score: teamScore, teamCount: teamCount };
            else return { rank: 0, score: 0, teamCount: 0 };
        }
        else return { rank: 0, score: 0, teamCount: 0 };
    }
    catch(e) {
        return { rank: 0, score: 0, teamCount: 0 };
    }
}

//Computes the metric values for the current game and returns a 'metrics' object
function computeMetrics(words, uniques, ranking, teamMetrics) {
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
        uniqueWords: uniques,
        hasTeam: 1 < teamMetrics.teamCount,
        teamScore: teamMetrics.score,
        teamRank: { rank: teamMetrics.rank, teamCount: teamMetrics.teamCount, totalPlayers: ranking.totalPlayers },
        teamRankPercentile: teamMetrics.rank / ranking.totalPlayers
    };
}

//Saves the game's metrics
function saveGameMetrics(metrics) {
    if (metrics.words.length) {
        let db = window.indexedDB.open('wordsplay_metrics', version);
        db.onupgradeneeded = event => event.target.result.createObjectStore("wordsplay_metrics", { keyPath: 'id', autoIncrement: false });
        db.onerror = err => console.error('Unable to access IndexedDB: ', err);

        db.onsuccess = function _dbOpenSuccess(evt) {
            let store = evt.target.result.transaction(['wordsplay_metrics'], 'readwrite').objectStore('wordsplay_metrics'),
                countRequest = store.count();

            countRequest.onsuccess = function _countRequestSuccess() {
                if (countRequest.result > 0) {
                    let metricsRequest = store.get(document.getElementById(b4x4Id).classList.contains('x-hide-display') ? b5x5Id : b4x4Id);

                    metricsRequest.onsuccess = function _metricsUpdateSuccess(evt) {
                        let data = evt.target.result;
                        //'onsuccess' event will be fired even if an entry for the request game board metrics does not exist;
                        //therefore, we have to check that data was actually returned before we start trying to update the value.
                        //If no data was returned, then there wasn't an entry for the request game board yet, so instead we just create
                        //a new entry using this game's metrics as the values.
                        if (data) {
                            data.highestScore = metrics.score > data.highestScore ? metrics.score : data.highestScore;
                            data.averageScore = ((data.gamesPlayed * data.averageScore) + metrics.score) / (data.gamesPlayed + 1);

                            if (metrics.rankings.rank < data.bestRank.rank) data.bestRank = metrics.rankings;
                            else if (metrics.rankings.rank === data.bestRank.rank) {
                                if (metrics.rankings.totalPlayers > data.bestRank.totalPlayers) data.bestRank = metrics.rankings;
                            }

                            data.mostGameWords = metrics.words.length > data.mostGameWords ? metrics.words.length : data.mostGameWords;
                            data.averageWordPoints = ((data.wordsCount * data.averageWordPoints) + metrics.score) / (data.wordsCount + metrics.words.length);
                            data.averageGamePoints = ((data.wordsCount + metrics.words.length) * data.averageWordPoints) / (data.gamesPlayed + 1);
                            data.averageGameWords = (data.wordsCount + metrics.words.length) / (data.gamesPlayed + 1);

                            data.bestRankPercentile = metrics.rankPercentile < data.bestRankPercentile ? metrics.rankPercentile : data.bestRankPercentile;
                            data.averageRankPercentile = ((data.gamesPlayed * data.averageRankPercentile) + metrics.rankPercentile) / (data.gamesPlayed + 1);
                            data.averageWordLength = ((data.averageWordLength * data.wordsCount) + metrics.charCount) / (data.wordsCount + metrics.words.length);
                            data.uniqueWords = unionWords(data.uniqueWords, metrics.uniqueWords);

                            if (metrics.longestWords[0].length > data.longestWords[0].length) data.longestWords = metrics.longestWords;
                            else if (metrics.longestWords[0].length === data.longestWords[0].length) data.longestWords = unionWords(data.longestWords, metrics.longestWords);

                            data.gamesPlayed += 1;
                            data.wordsCount = data.wordsCount + metrics.words.length;

                            if (metrics.hasTeam && data.teamGamesPlayed) {
                                if (metrics.teamRank.rank < data.teamBestRank) data.teamBestRank = metrics.teamRank;
                                else if (metrics.teamRank.rank === data.teamBestRank.rank && metrics.totalPlayers > data.teamBestRank.totalPlayers)
                                    data.teamBestRank = metrics.teamRank;

                                data.teamBestRankPercentile = metrics.teamRankPercentile < data.teamBestRankPercentile ?
                                    metrics.teamRankPercentile : data.teamBestRankPercentile;
                                data.teamAverageRankPercentile = ((data.teamGamesPlayed * data.teamAverageRankPercentile) + metrics.teamRankPercentile)
                                    / (data.teamGamesPlayed + 1);
                                data.teamHighestScore = metrics.teamScore > data.teamHighestScore ? metrics.teamScore : data.teamHighestScore;
                                data.teamAverageScore = ((data.teamGamesPlayed * data.teamAverageScore) + metrics.teamScore) / (data.teamGamesPlayed + 1);
                                data.teamAveragePlayers = ((data.teamGamesPlayed * data.teamAveragePlayers) + metrics.teamRank.teamCount) / (data.teamGamesPlayed + 1);
                                data.teamAverageScorePerPlayer = data.teamAverageScore / data.teamAveragePlayers;
                                data.teamAverageScoreContributionPercent = ((data.teamGamesPlayed * data.teamAverageScoreContributionPercent)
                                    + (metrics.score / metrics.teamScore)) / data.gamesPlayed + 1;
                                data.teamGamesPlayed++;
                            }
                            else if (metrics.hasTeam) {
                                data.teamBestRank = metrics.teamRank;
                                data.teamBestRankPercentile = metrics.teamRankPercentile;
                                data.teamAverageRankPercentile = metrics.teamRankPercentile;
                                data.teamHighestScore = metrics.teamScore;
                                data.teamAverageScore = metrics.teamScore;
                                data.teamAveragePlayers = metrics.teamRank.teamCount;
                                data.teamAverageScorePerPlayer = metrics.teamScore / metrics.teamRank.teamCount;
                                data.teamAverageScoreContributionPercent = metrics.score / metrics.teamScore;
                                data.teamGamesPlayed = 1;
                            }
                            else {
                                data.teamBestRank = { rank: 0, teamCount: 0, totalPlayers: 0 };
                                data.teamBestRankPercentile = 1;
                                data.teamAverageRankPercentile = 1;
                                data.teamHighestScore = 0;
                                data.teamAverageScore = 0;
                                data.teamAveragePlayers = 0;
                                data.teamAverageScorePerPlayer = 0;
                                data.teamAverageScoreContributionPercent = 0;
                                data.teamGamesPlayed = 0;
                            }

                            store.put(data);
                        }
                        else createNewBoardEntry(store, metrics);
                    };

                    metricsRequest.onerror = err => console.error('Unable to retrieve existing wordsplay metrics: ', err);
                }
                else createNewBoardEntry(store, metrics);
            };
        };
    }
}

//Creates a new entry into the IDB for a 4x4 or 5x5 board if one doesn't already exist
function createNewBoardEntry(store, metrics) {
    store.add({
        id: document.getElementById(b4x4Id).classList.contains('x-hide-display') ? b5x5Id : b4x4Id,
        highestScore: metrics.score,
        averageScore: metrics.score,
        bestRank: metrics.rankings,
        mostGameWords: metrics.words.length,
        averageWordPoints: metrics.averageWordPoints,
        averageGamePoints: metrics.score,
        averageGameWords: metrics.words.length,
        averageWordLength: metrics.charCount / metrics.words.length,
        bestRankPercentile: metrics.rankPercentile,
        averageRankPercentile: metrics.rankPercentile,
        uniqueWords: metrics.uniqueWords,
        longestWords: metrics.longestWords,
        wordsCount: metrics.words.length,
        gamesPlayed: 1,
        teamBestRank: metrics.hasTeam ? metrics.teamRank : { rank: 0, teamCount: 0, totalPlayers: 0 },
        teamBestRankPercentile: metrics.hasTeam ? metrics.teamRankPercentile : 1,
        teamAverageRankPercentile: metrics.hasTeam ? metrics.teamRankPercentile : 1,
        teamHighestScore: metrics.hasTeam ? metrics.teamScore : 0,
        teamAverageScore: metrics.hasTeam ? metrics.teamScore : 0,
        teamAveragePlayers: metrics.hasTeam ? metrics.teamRank.teamCount : 0,
        teamAverageScorePerPlayer: metrics.hasTeam ? metrics.teamScore / metrics.teamRank.teamCount : 0,
        teamAverageScoreContributionPercent: metrics.hasTeam ? metrics.score / metrics.teamScore : 0,
        teamGamesPlayed: metrics.hasTeam ? 1 : 0
    });
}

//Concats the player's current unique/longest words with the IDB's words - leaving out the duplicates
function unionWords(currentWords, newWords) {
    let res = currentWords;
    for (let word of newWords) {
        if (!res.includes(word)) res.push(word);
    }
    return res;
}

//Retrieves the game metrics when requested by the popup
function getGameMetrics(cb) {
    let db = window.indexedDB.open('wordsplay_metrics', version);

    db.onupgradeneeded = event => event.target.result.createObjectStore('wordsplay_metrics', { keyPath: 'id', autoIncrement: false });
    db.onerror = () => cb({ b4x4Id: defaultMetrics, b5x5Id: defaultMetrics });

    db.onsuccess = function _dbOpenSuccess(evt) {
        let store = evt.target.result.transaction('wordsplay_metrics').objectStore('wordsplay_metrics'),
            data = {};
        store.openCursor().onsuccess = function _cursorSuccess(e) {
            var cursor = e.target.result;
            if (cursor) {
                data[cursor.value.id] = cursor.value;
                cursor.continue();
            }
            else {
                if (!(b5x5Id in data)) data[b5x5Id] = defaultMetrics;
                if (!(b4x4Id in data)) data[b4x4Id] = defaultMetrics;
                cb(data);
            }
        };
    };
    return true;    //must return 'true' here in order for browser to keep the port open for a response
}

extension.runtime.onMessage.addListener((request, sender, sendResponse) => getGameMetrics(sendResponse));

//Overrides the minGameTime variable if found in browser storage
extension.storage.sync.get(['min_time'], function _storageRequestCallback(result) {
    minGameTime = result && result.min_time ? result.min_time * 1000 : minGameTime;
});

//Overrides the minGameWords variable if found in browser storage
extension.storage.sync.get(['min_words'], function _storageRequestCallback(result) {
    minGameWords = result && result.min_words ? result.min_words : minGameWords;
});

//Clears out the 4x4 game metrics and resets the option to 'false' afterwards
extension.storage.sync.get(['clear_4'], function _storageRequestClear4Callback(result) {
    if (result && result.clear_4) {
        let db = window.indexedDB.open('wordsplay_metrics', version);
        db.onupgradeneeded = event => event.target.result.createObjectStore('wordsplay_metrics', { keyPath: 'id', autoIncrement: false });
        db.onsuccess = function _clear4By4DataSuccess(evt) {
            evt.target.result.transaction('wordsplay_metrics', 'readwrite').objectStore('wordsplay_metrics').delete('b4x4');
            extension.storage.sync.set({ clear_4: false }, noop);
        };
    }
});

//Clears out the 5x5 game metrics and resets the option to 'false' afterwards
extension.storage.sync.get(['clear_5'], function _storageRequestClear5Callback(result) {
    if (result && result.clear_5) {
        let db = window.indexedDB.open('wordsplay_metrics', version);
        db.onupgradeneeded = event => event.target.result.createObjectStore('wordsplay_metrics', { keyPath: 'id', autoIncrement: false });
        db.onsuccess = function _clear5By5DataSuccess(evt) {
            evt.target.result.transaction('wordsplay_metrics', 'readwrite').objectStore('wordsplay_metrics').delete('b5x5');
            extension.storage.sync.set({ clear_5: false }, noop);
        };
    }
});