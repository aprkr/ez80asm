"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const hexRegex = /^(\$|0x)([0-9a-fA-F]+)$/;
const hexRegex2 = /^([0-9a-fA-F]+)h$/;
const binaryRegex = /^%([01]+)$/;
const binaryRegex2 = /^([01]+)b$/;
const integerRegex = /^[0-9]+d?$/;

class ASMHoverProvider {
    constructor(symbolDocumenter) {
        this.symbolDocumenter = symbolDocumenter;
    }
    provideHover(document, position, token) {
        const range = document.getWordRangeAtPosition(position, /((\$|0x)[A-Fa-f0-9]+\b)|(%[01]+\b)|([01]+b\b)|([0-9]+d?\b)|([.#]?[A-Za-z_]\w*(\\@|:*))|([A-Fa-f0-9]+h\b)/g);
        if (range) {
            const text = document.getText(range);
            const symbol = this.symbolDocumenter.symbol(text, document);
            let numberValue = undefined;
            if (symbol !== undefined && symbol.documentation !== undefined) {
                let hoverText = new vscode.MarkdownString()
                if (symbol.kind == vscode.SymbolKind.Variable) {
                    hoverText.appendCodeblock(symbol.documentation.replace("\t", " "), "ez80-asm")
                } else {
                    hoverText.appendMarkdown(symbol.documentation)
                }
                return new vscode.Hover(hoverText, range);
            }
            if (hexRegex.test(text)) {
                numberValue = parseInt(hexRegex.exec(text)[2], 16); // Group 2 of regex is actual digits
            } else if (hexRegex2.test(text)) {
                numberValue = parseInt(hexRegex2.exec(text)[1], 16); // Group 1, the only group, is actual digits
            } else if (binaryRegex.test(text)) {
                numberValue = parseInt(binaryRegex.exec(text)[1], 2); // Group 1, the only group, is actual digits
            } else if (binaryRegex2.test(text)) {
                numberValue = parseInt(binaryRegex2.exec(text)[1], 2); // Group 1, the only group, is actual digits
            } else if (integerRegex.test(text)) {
                numberValue = parseInt(text);
            }
            if (numberValue !== undefined) {
                let hoverText = new vscode.MarkdownString();
                hoverText.appendCodeblock(numberValue + "\n$" + numberValue.toString(16) + "\n%" + numberValue.toString(2))
                return new vscode.Hover(hoverText, range)
                // return new vscode.Hover(`\`${numberValue}\`\n\n\`\$${numberValue.toString(16)}\`\n\n\`%${numberValue.toString(2)}\``, range);
            }
        }
        return null;
    }
}
exports.ASMHoverProvider = ASMHoverProvider;