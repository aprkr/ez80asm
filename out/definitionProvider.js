"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Definition Provider, right click a symbol to use
 */
class definitionProvider {
    constructor(symbolDocumenter) {
        this.symbolDocumenter = symbolDocumenter;
    }
    provideDefinition(document, position, token) {
        const range = document.getWordRangeAtPosition(position, /([\w\.]+)/g);
        if (range) {
            const text = document.getText(range);
            const symbol = this.symbolDocumenter.checkSymbol(text, document.uri)
            if (symbol) {
                return symbol.location;
            }
        }
        return undefined;
    }
}
exports.definitionProvider = definitionProvider;
//# sourceMappingURL=definitionProvider.js.map