var identity = val => val;
var threeDecimals = val => Number.isInteger(val) ? val : val.toFixed(3);

var metricsDesc = {
        highestScore: 'Highest Score: ',
        averageScore: 'Average Score: ',
        lowestScore: 'Lowest Score: ',
        worstRank: 'Worst Rank: ',
        bestRank: 'Best Rank: ',
        averageRankPercentile: 'Average Rank Percentile: ',
        mostGameWords: 'Most Words In A Game: ',
        averageWordPoints: 'Average Points Per Words: ',
        averageGameWords: 'Average Words in a Game: ',
        averageWordLength: 'Average Word Length: ',
        uniqueWords: 'Unique Words: ',
        longestWords: 'Longest Words: ',
        gamesPlayed: 'Games Played: '
    },
    metricsModifier = {
        highestScore: identity,
        averageScore: threeDecimals,
        lowestScore: identity,
        averageRankPercentile: threeDecimals,
        mostGameWords: identity,
        averageWordPoints: threeDecimals,
        averageGameWords: threeDecimals,
        averageWordLength: threeDecimals,
        gamesPlayed: identity
    };

function getMetrics(cb) {
    chrome.tabs.query({active: true, currentWindow: true}, function _tabs(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'get_metrics' }, function _sentMessageCallback(response) {
            cb(response);
        });
    });
}

getMetrics(function _metricsCallback(metrics) {
    for (let boardId in metrics) {
        let board = document.getElementById(boardId);
        Array.from(board.querySelectorAll('.metric'))
            .forEach(function _addMetricToBoard(div) {
                let metricId = Array.from(div.classList).filter(c => c in metricsDesc)[0];
                if (metricId) {
                    if ('longestWords' !== metricId && 'uniqueWords' !== metricId) {
                        let titleSpan = document.createElement('span');
                        titleSpan.classList.add('title_span');
                        titleSpan.innerText = metricsDesc[metricId];

                        let contentSpan = document.createElement('span');
                        contentSpan.classList.add('content_span');

                        if ('worstRank' !== metricId && 'bestRank' !== metricId) contentSpan.innerText = metricsModifier[metricId](metrics[boardId][metricId]);
                        else contentSpan.innerText = metrics[boardId][metricId].rank + ' / ' + metrics[boardId][metricId].totalPlayers;

                        div.appendChild(titleSpan);
                        div.appendChild(contentSpan);
                    }
                    else {
                        let descSpan = document.createElement('span');
                        descSpan.classList.add('title_span');
                        descSpan.innerText = metricsDesc[metricId];
                        div.appendChild(descSpan);

                        metrics[boardId][metricId].forEach(function _createWordSpans(word, idx) {
                            let span = document.createElement('span');
                            span.classList.add('content_span');
                            let comma = idx === metrics[boardId][metricId].length - 1 ? '' : ', ';
                            span.innerText = word + comma;
                            div.appendChild(span);
                        });
                    }
                }
            });
    }
});