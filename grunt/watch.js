// Watches for changes to CSS or email templates then runs grunt tasks
module.exports = {
    "options" : {
        "livereload"    : false,
        "debounceDelay" : 750
    },
    "build"   : {
        "files" : [
            "*.js",
            "*.css",
            "*.html"
        ],
        "tasks" : [
            "clean",
            "build"
        ]
    }
};
