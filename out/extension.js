"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const hover = require("./hover");

function activate(context) {
    context.subscriptions.push(hover)
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map