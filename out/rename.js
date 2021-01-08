'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const symbolDocumenter = require("./symbolDocumenter")

/**
 * Allows you to rename symbols
 */
class renameProvider {
       constructor(symbolDocumenter) {
              this.symbolDocumenter = symbolDocumenter
       }
       /**
        * 
        * @param {vscode.TextDocument} document 
        * @param {vscode.Position} position 
        * @param {String} newName 
        * @param {vscode.CancellationToken} token 
        */
       provideRenameEdits(document, position, newName, token) {
              if (newName.match(/;/g)) {
                     vscode.window.showWarningMessage("Invalid name")
                     return new vscode.WorkspaceEdit()
              }
              const range = document.getWordRangeAtPosition(position, /([_A-Za-z\.][\w\.]*)/g);
              const existingSymbol = this.symbolDocumenter.checkSymbol(newName, document.uri)
              if (existingSymbol) {
                     if (vscode.workspace.getConfiguration().get("ez80-asm.caseInsensitive")) {
                            if (newName.toLowerCase() === existingSymbol.name.toLowerCase()) {
                                   vscode.window.showWarningMessage("There is already a symbol with this name")
                                   return new vscode.WorkspaceEdit()
                            }
                     } else {
                            vscode.window.showWarningMessage("There is already a symbol with this name")
                            return new vscode.WorkspaceEdit()
                     }
              }
              if (range) {
                     const text = document.getText(range);
                     const symbol = this.symbolDocumenter.checkSymbol(text, document.uri)
                     if (symbol) {
                            if (symbol.fsPath.match(/^.+\.inc/) && symbol.fsPath !== document.uri.fsPath) { // So you can't accidentally rename a symbol from a .inc file
                                   vscode.window.showWarningMessage("This symbol can only be changed in " + symbol.fsPath)
                                   return new vscode.WorkspaceEdit()
                            }
                            const uri = vscode.Uri.file(symbol.fsPath)
                            const table = this.symbolDocumenter.documents[uri.fsPath]
                            delete table.symbolDeclarations[text]
                            table.symbolDeclarations[newName] = new symbolDocumenter.SymbolDescriptor(symbol.line, symbol.kind, symbol.documentation, symbol.fsPath, newName);
                            let edits = new vscode.WorkspaceEdit()
                            const range = new vscode.Range(symbol.line, 0, symbol.line, symbol.name.length)
                            edits.replace(uri, range, newName)
                            this.addEdits(document.uri.fsPath, [], edits, newName, text) // this will grab all the edits
                            return edits
                     }
              }
              vscode.window.showWarningMessage("Symbol declaration not found")
              return new vscode.WorkspaceEdit()
       }
       /**
        * 
        * @param curfsPath 
        * @param {[]} searched 
        * @param {vscode.WorkspaceEdit} edits 
        * @param {String} newName 
        * @param {String} oldName 
        */
       addEdits(curfsPath, searched, edits, newName, oldName) {
              let table = this.symbolDocumenter.documents[curfsPath]
              searched.push(curfsPath)
              let length = table.possibleRefs.length
              for (let i = 0; i < length; i++) {
                     let match = false
                     if (vscode.workspace.getConfiguration().get("ez80-asm.caseInsensitive")) {
                            match = table.possibleRefs[i].text.toLowerCase() === oldName.toLowerCase()
                     } else {
                            match = table.possibleRefs[i].text === oldName
                     }
                     if (match) {
                            const oldRef = table.possibleRefs[i]
                            table.possibleRefs.splice(i, 1)
                            length--
                            i--
                            const ref = new symbolDocumenter.possibleRef(oldRef.line, oldRef.startChar, oldRef.startChar + newName.length, newName, oldRef.uri)
                            table.possibleRefs.push(ref)
                            edits.replace(oldRef.uri, oldRef.range, newName)
                     }
              }
              for (let i = 0; i < table.includes.length; i++) { // search included files
                     if (searched.indexOf(table.includes[i].fsPath) == -1) {
                            this.addEdits(table.includes[i], searched, edits, newName, oldName)
                     }
              }
              for (var fsPath in this.symbolDocumenter.documents) { // search files that include this one
                     table = this.symbolDocumenter.documents[fsPath]
                     for (let i = 0; i < table.includes.length; i++) {
                            if (table.includes[i].fsPath === curfsPath && searched.indexOf(fsPath) == -1) {
                                   this.addEdits(fsPath, searched, edits, newName, oldName)
                            }
                     }
              }
       }
}
exports.renameProvider = renameProvider