return {
    {
        "folke/which-key.nvim",
        opts = {},
        config = function()
            local wk = require("which-key")
            wk.add({
                { "<leader>g", group = "[G]it" },
                { "<leader>a", group = "[A]i" },
            })
        end,
    },

    {
        "sphamba/smear-cursor.nvim",
        opts = {},
    },

    {
        "folke/snacks.nvim",
        priority = 1000,
        keys = {
            {
                "<leader>q",
                function()
                    Snacks.bufdelete()
                end,
                desc = "バッファを閉じる（レイアウト保持）",
            },
        },

        opts = {
            dashboard = {
                enabled = true,
                autokeys = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
                preset = {
                    keys = {
                        { icon = " ", key = "n", desc = "New File", action = ":ene | startinsert" },
                        { icon = "󰊢", key = "l", desc = "LazyGit", action = ":lua Snacks.lazygit()" },
                        {
                            icon = "󰒲 ",
                            key = "L",
                            desc = "Lazy",
                            action = ":Lazy",
                            enabled = package.loaded.lazy ~= nil,
                        },
                        {
                            icon = " ",
                            key = "m",
                            desc = "Mason",
                            action = ":Mason",
                            enabled = package.loaded.lazy ~= nil,
                        },
                        { icon = " ", key = "q", desc = "Quit", action = ":qa" },
                    },
                },
                sections = {
                    { section = "header" },
                    { icon = " ", title = "Keymaps", section = "keys", indent = 2, padding = 1 },
                    {
                        icon = " ",
                        title = "Recent Files",
                        section = "recent_files",
                        cwd = true,
                        indent = 2,
                        padding = 1,
                    },
                    { icon = " ", title = "Projects", section = "projects", indent = 2, padding = 1 },
                    { section = "startup" },
                },
            },
            indent = {
                enabled = true,
            },
        },
    },

    {
        "folke/noice.nvim",
        opts = {
            lsp = {
                -- override markdown rendering so that **cmp** and other plugins use **Treesitter**
                override = {
                    ["vim.lsp.util.convert_input_to_markdown_lines"] = true,
                    ["vim.lsp.util.stylize_markdown"] = true,
                    ["cmp.entry.get_documentation"] = true, -- requires hrsh7th/nvim-cmp
                },
            },
            -- you can enable a preset for easier configuration
            presets = {
                bottom_search = false, -- use a classic bottom cmdline for search
                command_palette = true, -- position the cmdline and popupmenu together
                long_message_to_split = true, -- long messages will be sent to a split
                inc_rename = false, -- enables an input dialog for inc-rename.nvim
                lsp_doc_border = false, -- add a border to hover docs and signature help
            },
        },
    },

    {
        -- 折り畳みを高機能化
        "kevinhwang91/nvim-ufo",
        dependencies = { "kevinhwang91/promise-async" },
        config = function()
            vim.o.foldcolumn = "1"
            -- 起動時に開いた状態にするために 99 を設定
            vim.o.foldlevel = 99
            vim.o.foldlevelstart = 99
            vim.o.foldenable = true

            vim.keymap.set("n", "zR", require("ufo").openAllFolds)
            vim.keymap.set("n", "zM", require("ufo").closeAllFolds)
            require("ufo").setup()
        end,
    },

    {
        "MeanderingProgrammer/render-markdown.nvim",
        ---@module 'render-markdown'
        ---@type render.md.UserConfig
        opts = {
            file_types = {
                "AgenticChat"
            },
            code = {
                sign = false,
                border = "thick",
            },
        },
    },

    {
        "esmuellert/codediff.nvim",
        opts = {},
    },

    {
        -- 右上にファイル名やGitの変更差分、Diagnosticsの情報を表示
        "b0o/incline.nvim",
        config = function()
            local devicons = require("nvim-web-devicons")
            require("incline").setup({
                render = function(props)
                    local filename = vim.fn.fnamemodify(vim.api.nvim_buf_get_name(props.buf), ":t")
                    if filename == "" then
                        filename = "[No Name]"
                    end
                    local ft_icon, ft_color = devicons.get_icon_color(filename)

                    local function get_git_diff()
                        local icons = { removed = "", changed = "", added = "" }
                        local signs = vim.b[props.buf].gitsigns_status_dict
                        local labels = {}
                        if signs == nil then
                            return labels
                        end
                        for name, icon in pairs(icons) do
                            if tonumber(signs[name]) and signs[name] > 0 then
                                table.insert(labels, { icon .. signs[name] .. " ", group = "Diff" .. name })
                            end
                        end
                        if #labels > 0 then
                            table.insert(labels, { "┊ " })
                        end
                        return labels
                    end

                    local function get_diagnostic_label()
                        local icons = { error = "", warn = "", info = "", hint = "" }
                        local label = {}

                        for severity, icon in pairs(icons) do
                            local n = #vim.diagnostic.get(
                                props.buf,
                                { severity = vim.diagnostic.severity[string.upper(severity)] }
                            )
                            if n > 0 then
                                table.insert(label, { icon .. n .. " ", group = "DiagnosticSign" .. severity })
                            end
                        end
                        if #label > 0 then
                            table.insert(label, { "┊ " })
                        end
                        return label
                    end

                    return {
                        { get_diagnostic_label() },
                        { get_git_diff() },
                        {
                            (ft_icon or "") .. " ",
                            guifg = ft_color,
                            guibg = "none",
                        },
                        { filename .. " ", gui = vim.bo[props.buf].modified and "bold,italic" or "bold" },
                    }
                end,
            })
        end,
    },

    {
        -- vimモードを色で表示する
        "mvllow/modes.nvim",
        opts = {
            colors = {
                bg = "", -- Optional bg param, defaults to Normal hl group
                copy = "#f5c359",
                delete = "#c75c6a",
                change = "#c75c6a", -- Optional param, defaults to delete
                format = "#c79585",
                insert = "#78ccc5",
                replace = "#245361",
                select = "#9745be", -- Optional param, defaults to visual
                visual = "#9745be",
            },

            line_opacity = 0.4,
        },
    },

    {
        -- 今カレントのファイル以外を暗くする
        "tadaa/vimade",
        opts = {
            recipe = { "default", { animate = true } },
            fadelevel = 0.5,
        },
    },

    {
        "Owen-Dechow/videre.nvim",
        dependencies = {
            "Owen-Dechow/graph_view_yaml_parser",
            "Owen-Dechow/graph_view_toml_parser",
            "a-usr/xml2lua.nvim",
        },
        opts = {
            round_units = true,
            simple_statusline = true,
        },
    },
}
