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
};

var metricsModifier = {
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
    Array.from(document.querySelectorAll('.metrics_div'))
        .forEach(function _addMetricToDOM(div) {
            let divId = div.id;
            if (divId in metrics) {
                if ('longestWords' !== divId && 'uniqueWords' !== divId) {
                    let titleSpan = document.createElement('span');
                    titleSpan.classList.add('title_span');
                    titleSpan.innerText = metricsDesc[divId];

                    let contentSpan = document.createElement('span');
                    contentSpan.classList.add('content_span');

                    if ('worstRank' !== divId && 'bestRank' !== divId) contentSpan.innerText = metricsModifier[divId](metrics[divId]);
                    else contentSpan.innerText = metrics[divId].rank + ' / ' + metrics[divId].totalPlayers;

                    div.appendChild(titleSpan);
                    div.appendChild(contentSpan);
                }
                else {
                    let descSpan = document.createElement('span');
                    descSpan.classList.add('title_span');
                    descSpan.innerText = metricsDesc[divId];
                    div.appendChild(descSpan);

                    metrics[divId].forEach(function _createWordSpans(word, idx) {
                        let span = document.createElement('span');
                        span.classList.add('content_span');
                        let comma = idx === metrics[divId].length - 1 ? '' : ', ';
                        span.innerText = word + comma;
                        div.appendChild(span);
                    });
                }
            }
        });
});