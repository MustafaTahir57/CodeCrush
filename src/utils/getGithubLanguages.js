const axios = require("axios")

const getGithubLanguages = async (accessToken, username) => {
    // Fetch all repos
    const reposRes = await axios.get(
        `https://api.github.com/user/repos?per_page=100&affiliation=owner`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const repos = reposRes.data;

    // Aggregate languages across all repos
    const languageTotals = {};

    for (const repo of repos) {
        if (repo.fork) continue; // skip forked repos, not original work

        try {
            const langRes = await axios.get(repo.languages_url, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            for (const [lang, bytes] of Object.entries(langRes.data)) {
                languageTotals[lang] = (languageTotals[lang] || 0) + bytes;
            }
        } catch (err) {
            console.log(`Skipped ${repo.name}: ${err.message}`);
        }
    }

    // Sort languages by usage, return as skill tags
    const skillTags = Object.entries(languageTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([lang]) => lang);

    return {
        skillTags,
        repoCount: repos.length,
        languageTotals,
    };
};

module.exports = getGithubLanguages