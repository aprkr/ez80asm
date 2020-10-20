"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");

function activate(context) {
    context.subscriptions.push(vscode.languages.registerHoverProvider('ez80-asm', 
        {provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position);
            return new vscode.Hover("I am a hover!", range);
        }}
    ))
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map