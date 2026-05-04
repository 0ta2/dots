vim.loader.enable()

-- リーダーキーを `<space>` に設定
-- 詳しくは、 `:help mapleader` を参照
vim.g.mapleader = " "
vim.g.maplocalleader = " "

vim.api.nvim_create_user_command("PackUpdate", function()
    vim.pack.update()
end, { desc = "Update all plugins" })

vim.api.nvim_create_user_command("PackClean", function()
    local to_remove = {}
    for _, plugin in ipairs(vim.pack.get()) do
        if not plugin.active then
            table.insert(to_remove, plugin.spec.name)
        end
    end
    if #to_remove == 0 then
        vim.notify("No unused plugins.")
        return
    end
    local choice = vim.fn.confirm("Remove: " .. table.concat(to_remove, ", ") .. "?", "&Yes\n&No", 2)
    if choice == 1 then
        vim.pack.del(to_remove)
    end
end, { desc = "Remove inactive plugins" })

vim.api.nvim_create_autocmd("PackChanged", {
    desc = "Plugin install/update hooks",
    callback = function(ev)
        local spec = ev.data.spec
        local kind = ev.data.kind
        if spec.name == "nvim-treesitter" and kind == "update" then
            pcall(function()
                require("nvim-treesitter").update()
            end)
        elseif spec.name == "LuaSnip" and (kind == "install" or kind == "update") then
            vim.system({ "make", "install_jsregexp" }, { cwd = spec.path })
        end
    end,
})
