"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");

/**
 * Provides reference locations
 */
class referenceProvider {
       constructor(symbolDocumenter) {
              this.symbolDocumenter = symbolDocumenter
       }
       /**
        * 
        * @param {vscode.TextDocument} document 
        * @param {vscode.Position} position 
        * @param {vscode.ReferenceContext} context 
        * @param {vscode.CancellationToken} token 
        */
       provideReferences(document, position, context, token) {
              const range = document.getWordRangeAtPosition(position, /([\w\.]+)/g);
              let output = []
              if (range) {
                     const text = document.getText(range);
                     const symbol = this.symbolDocumenter.checkSymbol(text, document.uri)
                     if (symbol) {
                            if (context.includeDeclaration) {
                                   const range = new vscode.Range(symbol.line, 0, symbol.line, symbol.name.length)
                                   const uri = vscode.Uri.file(symbol.fsPath)
                                   output.push(new vscode.Location(uri, range))
                            }
                            output = output.concat(this.findRefs(document.uri, [], [], symbol.name))
                            return output
                     }
              }
       }
       /**
        * 
        * @param {vscode.Uri} uri 
        * @param {[]} searched 
        * @param {*} output 
        * @param {String} name 
        */
       findRefs(uri, searched, output, name) {
              let table = this.symbolDocumenter.documents[uri.fsPath]
              searched.push(uri.fsPath)
              for (let i = 0; i < table.possibleRefs.length; i++) {
                     let match = false
                     if (vscode.workspace.getConfiguration().get("ez80-asm.caseInsensitive")) {
                            match = table.possibleRefs[i].text.toLowerCase() === name.toLowerCase()
                     } else {
                            match = table.possibleRefs[i].text === name
                     }
                     if (match) {
                            output.push(table.possibleRefs[i].location)
                     }
              }
              for (let i = 0; i < table.includes.length; i++) { // search included files
                     if (searched.indexOf(table.includes[i].fsPath) == -1) {
                            this.findRefs(table.includes[i], searched, output, name)
                     }
              }
              for (var fsPath in this.symbolDocumenter.documents) { // search files that include this one
                     table = this.symbolDocumenter.documents[fsPath]
                     for (let i = 0; i < table.includes.length; i++) {
                            if (table.includes[i].fsPath === uri.fsPath && searched.indexOf(fsPath) == -1) {
                                   const docuri = vscode.Uri.file(fsPath)
                                   this.findRefs(docuri, searched, output, name)
                            }
                     }
              }
              return output

       }
}

exports.referenceProvider = referenceProvider