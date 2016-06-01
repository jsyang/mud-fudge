module.exports = {
    "mkdirBuild" : "mkdir -p build",
    "copySrc" : "cat micromarkdown.js >> build/index.js ; cat index.js >> build/index.js ; cp index.html build ; cp index.css build"
};