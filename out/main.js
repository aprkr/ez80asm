'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const imports = require("./imports")
const fs = require("fs")
const path = require("path")

class main {
       /**
        * @param {imports.symbolDocumenter} symbolDocumenter 
        * @param {imports.diagnosticProvider} diagnosticProvider 
        */
       constructor(symbolDocumenter, diagnosticProvider) {
              this.symbolDocumenter = symbolDocumenter
              this.diagnosticProvider = diagnosticProvider
              const scanDoc = async (document, event) => {
                     if (!document.fileName.match(/(ez80|inc)$/i)) {
                            return
                     }
                     this.symbolDocumenter.declareSymbols(document, event)
                     if (!event) {
                            setTimeout(() => { this.diagnosticProvider.getDiagnostics(document) }, 2000)
                     } else {
                            this.diagnosticProvider.getDiagnostics(document, event)
                     }
              }
              vscode.workspace.findFiles("**/*{Main,main}.{ez80}", null, 1).then((files) => {
                     files.forEach((fileURI) => {
                            vscode.workspace.openTextDocument(fileURI).then((document) => {
                                   if (!this.symbolDocumenter.documents[document.uri.fsPath]) {
                                          scanDoc(document);
                                   }
                            });
                     });
              });
              vscode.workspace.findFiles("**/*.{ez80}", null, 2).then((files) => {
                     files.forEach((fileURI) => {
                            vscode.workspace.openTextDocument(fileURI).then((document) => {
                                   if (!this.symbolDocumenter.documents[document.uri.fsPath]) {
                                          scanDoc(document);
                                   }
                            });
                     });
              });
              /**
               * @param {vscode.TextDocument} document 
               */
              const docOpened = (document) => { // if a file was just opened
                     if (!this.symbolDocumenter.documents[document.uri.fsPath] && document.fileName.match(/(ez80|inc)$/i)) {
                            scanDoc(document)
                            setTimeout(() => { diagnoseOtherDocs(document) }, 2000)
                     }
                     if (this.symbolDocumenter.documents[document.uri.fsPath]) {
                            this.symbolDocumenter.writeTableToFile(document)
                     }
              }
              const diagnoseOtherDocs = (document) => { // check references in other files
                     for (let i = 0; i < vscode.workspace.textDocuments.length; i++) {
                            const doc = vscode.workspace.textDocuments[i]
                            if (doc != document && !doc.isClosed && this.symbolDocumenter.documents[doc.uri.fsPath] && !doc.fileName.match(/(inc)$/i)) {
                                   this.diagnosticProvider.scanRefs(doc)
                            }
                     }
              }
              vscode.workspace.onDidOpenTextDocument((document) => {
                     setTimeout(() => { docOpened(document) }, 50) // This is to make sure declareSymbols() starts going before scanDoc   
              })
              var otherDocTimeout = 0
              vscode.workspace.onDidChangeTextDocument((event) => { // if the file changed, update symbols and diagnostics, and check references for other files
                     clearTimeout(otherDocTimeout)
                     scanDoc(event.document, event)
                     otherDocTimeout = setTimeout(() => { diagnoseOtherDocs(event.document) }, 200)
              })
              vscode.workspace.onDidRenameFiles((event) => {
                     for (let i = 0; i < event.files.length; i++) {
                            const oldfsPath = event.files[i].oldUri.fsPath
                            const oldTable = this.symbolDocumenter.documents[oldfsPath]
                            if (oldTable) {
                                   const base = path.basename(oldfsPath)
                                   const oldCachePath = path.join(this.symbolDocumenter.cacheFolder, base + ".json");
                                   fs.unlink(oldCachePath, (error) => {
                                          console.log(error.message)
                                   })
                                   const newTable = oldTable
                                   const newUri = event.files[i].newUri
                                   const newfsPath = newUri.fsPath
                                   newTable.fsPath = newfsPath
                                   oldTable.diagnosticCollection.clear()
                                   delete this.symbolDocumenter.documents[oldfsPath]
                                   newTable.diagnosticCollection.set(newfsPath, newTable.fullArray)
                                   this.symbolDocumenter.documents[newfsPath] = newTable
                            }
                     }
              })
              vscode.workspace.onDidDeleteFiles((event) => {
                     for (let i = 0; i < event.files.length; i++) {
                            delete this.symbolDocumenter.documents[event.files[i].fsPath]
                     }
              })
              vscode.workspace.onDidSaveTextDocument((document) => {
                     if (this.symbolDocumenter.documents[document.uri.fsPath]) {
                            const file = fs.statSync(document.uri.fsPath)
                            this.symbolDocumenter.documents[document.uri.fsPath].lastModified = file.mtimeMs
                            this.symbolDocumenter.writeTableToFile(document)
                     }
              })
              if (vscode.window.activeTextEditor && !this.symbolDocumenter.documents[vscode.window.activeTextEditor.document.uri.fsPath]) { // if there is an currently open file
                     scanDoc(vscode.window.activeTextEditor.document)
                     setTimeout(() => { diagnoseOtherDocs(vscode.window.activeTextEditor.document) }, 2100)
              }
       }
}
exports.main = main