'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");

class main {
       constructor(symbolDocumenter, diagnosticProvider) {
              this.symbolDocumenter = symbolDocumenter
              this.diagnosticProvider = diagnosticProvider
              let ms = 1000
              const scanDoc = async (document, event) => {
                     if (!document.fileName.match(/(ez80|z80|inc|asm)$/i)) {
                            return
                     }
                     this.symbolDocumenter.declareSymbols(document, event)
                     if (!event) {
                            setTimeout(() => { this.diagnosticProvider.getDiagnostics(document) }, ms)
                     } else {
                            this.diagnosticProvider.getDiagnostics(document, event)
                     }                     
              }
              vscode.workspace.findFiles("**/*{Main,main}.{ez80,z80,asm}", null, 1).then((files) => {
                     files.forEach((fileURI) => {
                            vscode.workspace.openTextDocument(fileURI).then((document) => {
                                   scanDoc(document);
                            });
                     });
              });
              const docOpened = (document) => {
                     if (!this.symbolDocumenter.documents[document.uri] && document.fileName.match(/(ez80|z80|inc|asm)$/i)) {
                            scanDoc(document)
                            setTimeout(() => { diagnoseOtherDocs(document) }, 300)
                     }
              }
              const diagnoseOtherDocs = (document) => {
                     for (let i = 0; i < vscode.workspace.textDocuments.length; i++) {
                            const doc = vscode.workspace.textDocuments[i]
                            if (doc != document && !doc.isClosed && this.symbolDocumenter.documents[doc.uri] && !doc.fileName.match(/(inc)$/i)) {
                                   this.diagnosticProvider.scanRefs(doc)
                            }
                     }
              }
              vscode.workspace.onDidOpenTextDocument((document) => {
                     setTimeout(() => { docOpened(document) }, 50) // This is to make sure declareSymbols() starts going before scanDoc   
              })
              var scanTimeout = 0
              var otherDocTimeout = 0
              vscode.workspace.onDidChangeTextDocument((event) => {
                     // clearTimeout(scanTimeout)
                     clearTimeout(otherDocTimeout)
                     scanDoc(event.document, event)
                     otherDocTimeout = setTimeout(() => { diagnoseOtherDocs(event.document) }, 500)
              })
              if (vscode.window.activeTextEditor && !this.symbolDocumenter.documents[vscode.window.activeTextEditor.document.uri]) {
                     scanDoc(vscode.window.activeTextEditor.document)
              }
              ms = 100
       }
       removeOldStuff(document, event) {
              if (!event) {

              }
       }
}
exports.main = main