"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
/**
 * Provide symbols for the go to symbol feature
 */
class ASMDocumentSymbolProvider {
    constructor(symbolDocumenter) {
        this.symbolDocumenter = symbolDocumenter;
    }
    provideDocumentSymbols(document, token) {
        const table = this.symbolDocumenter.documents[document.uri];
        if (!table) {
            return
        }
        const output = [];
        for (const name in table.symbolDeclarations) {
            const symbol = table.symbolDeclarations[name];
            output.push(new vscode.SymbolInformation(symbol.name, symbol.kind, undefined, symbol.location));     
        }
        return output;
    }
}
    exports.ASMDocumentSymbolProvider = ASMDocumentSymbolProvider;
//# sourceMappingURL=documentSymbolProvider.js.map