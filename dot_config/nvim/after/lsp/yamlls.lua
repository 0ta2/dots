return {
    settings = {
        yaml = {
            format = { printWidth = 1000 },
            schemaStore = {
                enable = false,
                -- Avoid TypeError: Cannot read properties of undefined (reading 'length')
                url = "",
            },
            schemas = require("schemastore").yaml.schemas(),
        },
    },
}
