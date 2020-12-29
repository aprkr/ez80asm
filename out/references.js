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
       provideReferences(document, position, context, token) {
              const range = document.getWordRangeAtPosition(position, /([\w\.]+)/g);
              let output = []
              if (range) {
                     const text = document.getText(range);
                     const symbol = this.symbolDocumenter.checkSymbol(text, document.uri)
                     if (symbol) {
                            if (context.includeDeclaration) {
                                   output.push(symbol.location)
                            }
                            output = output.concat(this.findRefs(document.uri, [], [], symbol.name))
                            return output
                     }
              }
       }
       findRefs(uri, searched, output, name) {
              let table = this.symbolDocumenter.documents[uri]
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
              for (var fileuri in this.symbolDocumenter.documents) { // search files that include this one
                     table = this.symbolDocumenter.documents[fileuri]
                     for (let i = 0; i < table.includes.length; i++) {
                            fileuri = vscode.Uri.parse(fileuri)
                            if (table.includes[i].fsPath === uri.fsPath && searched.indexOf(fileuri.fsPath) == -1) {
                                   this.findRefs(fileuri, searched, output, name)
                            }
                     }
              }
              return output

       }
}

exports.referenceProvider = referenceProvider