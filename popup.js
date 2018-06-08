var identity = val => val,
    threeDecimals = val => Number.parseFloat(val.toFixed(3)),
    percentize = val => Number.parseFloat(((1 - val) * 100).toFixed(3)) + '%',
    extension = 'undefined' !== typeof chrome && chrome.tabs ? chrome : browser;

var metricsDesc = {
        highestScore: 'Highest Score: ',
        averageScore: 'Average Score: ',
        bestRank: 'Best Rank: ',
        bestRankPercentile: 'Best Rank Percentile: ',
        averageRankPercentile: 'Average Rank Percentile: ',
        mostGameWords: 'Most Words In A Game: ',
        averageWordPoints: 'Average Points Per Words: ',
        averageGameWords: 'Average Words in a Game: ',
        averageWordLength: 'Average Word Length: ',
        uniqueWords: 'Unique Words: ',
        longestWords: 'Longest Words: ',
        gamesPlayed: 'Games Played: ',
        teamBestRank: 'Best Rank: ',
        teamBestRankPercentile: 'Best Rank Percentile: ',
        teamAverageRankPercentile: 'Average Rank Percentile: ',
        teamHighestScore: 'Highest Score: ',
        teamAverageScore: 'Average Score: ',
        teamAverageScorePerPlayer: 'Average Score Per Player: ',
        teamAverageScoreContributionPercent: 'Average Score Contribution Percent: ',
        teamGamesPlayed: 'Games Played: '
    },
    metricsModifier = {
        highestScore: identity,
        averageScore: threeDecimals,
        bestRankPercentile: percentize,
        averageRankPercentile: percentize,
        mostGameWords: identity,
        averageWordPoints: threeDecimals,
        averageGameWords: threeDecimals,
        averageWordLength: threeDecimals,
        gamesPlayed: identity,
        teamBestRankPercentile: percentize,
        teamAverageRankPercentile: percentize,
        teamHighestScore: identity,
        teamAverageScore: threeDecimals,
        teamAverageScorePerPlayer: threeDecimals,
        teamAverageScoreContributionPercent: threeDecimals,
        teamGamesPlayed: identity
    };

//Retrieves the game metrics from wordsplay_metrics.js file
function getMetrics(cb) {
    extension.tabs.query({active: true, currentWindow: true}, function _tabs(tabs) {
        extension.tabs.sendMessage(tabs[0].id, { action: 'get_metrics' }, function _sentMessageCallback(response) {
            cb(response);
        });
    });
}

//Creates and appends the title span for each metric
function createAndAppendTitleSpan(metricId, div) {
    let titleSpan = document.createElement('span');
    titleSpan.classList.add('title_span');
    titleSpan.innerText = metricsDesc[metricId];
    div.appendChild(titleSpan);
}

//Initiates the metric retrieval and provides a callback that displays the metrics
getMetrics(function _metricsCallback(metrics) {
    Object.keys(metrics).forEach(boardId => {
        let board = document.getElementById(boardId);
        Array.from(board.querySelectorAll('.metric'))
            .forEach(div => {
                let metricId = Array.from(div.classList).filter(c => c in metricsDesc)[0];
                if (metricId) {
                    if ('longestWords' !== metricId && 'uniqueWords' !== metricId) {
                        createAndAppendTitleSpan(metricId, div);
                        let contentSpan = document.createElement('span');
                        contentSpan.classList.add('content_span');

                        if ('bestRank' !== metricId && 'teamBestRank' !== metricId) contentSpan.innerText = metricsModifier[metricId](metrics[boardId][metricId]);
                        else if ('bestRank' === metricId) contentSpan.innerText = `${metrics[boardId][metricId].rank} / ${metrics[boardId][metricId].totalPlayers}`;
                        else contentSpan.innerText = `Rank: ${metrics[boardId][metricId].rank} / ${metrics[boardId][metricId].totalPlayers} Team Members: ${metrics[boardId][metricId].teamCount}`;

                        div.appendChild(contentSpan);
                    }
                    else {
                        createAndAppendTitleSpan(metricId, div);
                        metrics[boardId][metricId].forEach(function _createWordSpans(word, idx) {
                            let span = document.createElement('span');
                            span.classList.add('content_span');
                            span.innerText = `${word}${idx === metrics[boardId][metricId].length - 1 ? '' : ', '}`;
                            div.appendChild(span);
                        });
                    }
                }
            });
    });
});