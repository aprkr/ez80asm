"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const hexRegex = /^\$([0-9a-fA-F]+)$/;
const binaryRegex = /^%([01]+)$/;
const integerRegex = /^[0-9]+d?$/;

function activate(context) {
    context.subscriptions.push(vscode.languages.registerHoverProvider('ez80-asm', 
        {provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position, /(\$[A-Fa-f0-9]+\b)|(%[01]+\b)|([0-9]+d?\b)|([.#]?[A-Za-z_]\w*(\\@|:*))/g);
            if (range) {
                const text = document.getText(range);
                let numberValue = undefined;
                if (hexRegex.test(text)) {
                    numberValue = parseInt(hexRegex.exec(text)[1], 16);
                } else if (binaryRegex.test(text)) {
                    numberValue = parseInt(binaryRegex.exec(text)[1], 2);
                } else if (integerRegex.test(text)) {
                    numberValue = parseInt(text);
                }
                if (numberValue !== undefined) {
                    return new vscode.Hover(`\`${numberValue}\`\n\n\`\$${numberValue.toString(16)}\`\n\n\`%${numberValue.toString(2)}\``, range);
                } else {
                    //return new vscode.Hover("LOLOLOL", range);
                }
            }
        }}
    ))
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map