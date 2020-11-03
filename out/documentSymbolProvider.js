"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
class ASMDocumentSymbolProvider {
    constructor(symbolDocumenter) {
        this.symbolDocumenter = symbolDocumenter;
    }
    provideDocumentSymbols(document, token) {
        const table = this.symbolDocumenter.files[document.fileName];
        if (table == null) {
            return [];
        }
        const output = [];
        for (const name in table.symbols) {
            if (table.symbols.hasOwnProperty(name)) {
                const symbol = table.symbols[name];
                output.push(new vscode.SymbolInformation(name, symbol.kind, undefined, symbol.location));
            }
        }
        return output;
    }
}
exports.ASMDocumentSymbolProvider = ASMDocumentSymbolProvider;
//# sourceMappingURL=documentSymbolProvider.js.map