return {
    settings = {
        yaml = {
            schemaStore = {
                enable = false,
                -- Avoid TypeError: Cannot read properties of undefined (reading 'length')
                url = "",
            },
            schemas = require('schemastore').yaml.schemas {
                select = {
                    "GitHub Workflow",
                    "docker-compose.yml"
                }
            },
        },
    },
}
