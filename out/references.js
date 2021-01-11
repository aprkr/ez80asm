"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const imports = require("./imports")

/**
 * Provides reference locations
 */
class referenceProvider {
       /**
        * 
        * @param {imports.symbolDocumenter} symbolDocumenter 
        */
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
                            output = output.concat(this.findRefs(document.uri.fsPath, [], [], symbol.name))
                            return output
                     }
              }
       }
       /**
        * 
        * @param {String} docPath 
        * @param {[]} searched 
        * @param {*} output 
        * @param {String} name 
        */
       findRefs(docPath, searched, output, name) {
              let table = this.symbolDocumenter.documents[docPath]
              searched.push(docPath)
              const refs = this.symbolDocumenter.getDocRefs(table)
              for (let i = 0; i < refs.length; i++) {
                     let match = false
                     if (vscode.workspace.getConfiguration().get("ez80-asm.caseInsensitive")) {
                            match = refs[i].name.toLowerCase() === name.toLowerCase()
                     } else {
                            match = refs[i].name === name
                     }
                     if (match) {
                            const uri = vscode.Uri.file(refs[i].fsPath)
                            const location = new vscode.Location(uri, refs[i].range)
                            output.push(location)
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
                            if (table.includes[i] === docPath && searched.indexOf(fsPath) == -1) {
                                   this.findRefs(fsPath, searched, output, name)
                            }
                     }
              }
              return output

       }
}

exports.referenceProvider = referenceProvider