return {
    settings = {
        json = {
            schemas = require('schemastore').json.schemas {
                select = {
                    "package.json"
                },
            },
        },
        validate = { enable = true },
    },
}
