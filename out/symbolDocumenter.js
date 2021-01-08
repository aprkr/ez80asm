'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const commentLineRegex = /^\s*;\s*(.*)$/;
const endCommentRegex = /^[^;]+;\s*(.*)$/;
const includeLineRegex = /^\s*\#?(include)[\W]+"([^"]+)".*$/i;
const FILE_NAME = 2;
const labelDefinitionRegex = /^[\w\.]+:{0,2}((?=\s*;|\s*$)|(?=[\s\.]+equ))/i;
// const equateRegexold = /^[\s]*[a-zA-Z_][a-zA-Z_0-9]*[\W]+(equ|set)[\W]+.*$/i;
const equateRegex = /^\s*[\w\.]+\s+\.?(equ|set)\s.+/i
const nonCommentRegex = /^([^;]+[^\,\s;])/g
const wordregex = /[\$\%]?[\w\.]+/g
const nonRegRegex = /((\$|0x)[A-Fa-f0-9]+\b)|(%[01]+\b)|(\b[01]+b\b)|(\b[0-9]+d?\b)|\b([A-Fa-f0-9]+h\b)|\b(A|B|C|D|E|F|H|L|I|R|IX|IY|IXH|IXL|IYH|IYL|AF|BC|DE|HL|PC|SP|AF'|MB)\b|\b(equ|set)\b/gi

class SymbolDescriptor {
       constructor(line, kind, documentation, fsPath, name) {
              this.line = line
              this.kind = kind
              this.documentation = documentation
              this.fsPath = fsPath
              this.name = name
       }
}
class possibleRef {
       constructor(line, startChar, endChar, text, fsPath) {
              this.line = line
              this.startChar = startChar
              this.endChar = endChar
              this.text = text
              this.fsPath = fsPath
       }
       get range() {
              return new vscode.Range(this.line, this.startChar, this.line, this.endChar)
       }
       get location() {
              return new vscode.Location(this.uri, this.range)
       }
       get uri() {
              return vscode.Uri.file(this.fsPath)
       }
}
class DocumentTable {
       constructor(uri) {
              this.lastModified = (fs.statSync(uri.fsPath)).mtimeMs
              this.includes = []
              this.includeFileLines = []
              this.fsPath = uri.fsPath
              // this.directory = path.dirname(uri.fsPath)
              // this.path = uri.fsPath
              this.symbolDeclarations = {}
              this.diagnosticCollection = vscode.languages.createDiagnosticCollection();
              this.diagnosticCollection.array = []
              this.diagnosticCollection.symarray = []
              this.diagnosticCollection.redefArray = []
              this.lineCount = 0;
              this.possibleRefs = []
              this.reDefinitions = []
       }
       get fullArray() {
              return this.diagnosticCollection.array.concat(this.diagnosticCollection.symarray.concat(this.diagnosticCollection.redefArray))
       }
}
class symbolDocumenter {
       constructor() {
              this.documents = {}
              this.extensionPath = (vscode.extensions.getExtension("alex-parker.ez80-asm")).extensionPath;
              this.cacheFolder = path.join(this.extensionPath, "/caches")
       }
       /**
        * 
        * @param {vscode.TextDocument} document 
        * @param {vscode.TextDocumentChangeEvent} event 
        */
       declareSymbols(document, event) {
              if (!event) {
                     this.readTableFromFile(document.uri.fsPath)
              }
              if (event && event.contentChanges.length == 0) {
                     return
              }
              if (event && event.contentChanges.length > 1) {
                     for (let i = 1; i < event.contentChanges.length; i++) {
                            const pseudoEvent = {}
                            pseudoEvent.contentChanges = []
                            pseudoEvent.contentChanges.push(event.contentChanges[i])
                            this.declareSymbols(document, pseudoEvent)
                     }
              }
              let table = new DocumentTable(document.uri)
              let startLine = 0;
              let endLine = document.lineCount;
              if (event && event.contentChanges.length > 0) {
                     table = this.documents[document.uri.fsPath];
                     startLine = event.contentChanges[0].range.start.line
                     endLine = event.contentChanges[0].range.end.line + 1
                     const deleteEndLine = endLine
                     const newLinematch = event.contentChanges[0].text.match(/\n/g)
                     if (newLinematch) {
                            endLine += newLinematch.length
                     } else if (table.lineCount > document.lineCount && event.contentChanges[0].text === "") {
                            endLine = startLine + 1
                     }
                     while (endLine < document.lineCount && commentLineRegex.exec(document.lineAt(endLine).text)) {
                            endLine++
                     }
                     if (endLine < document.lineCount && labelDefinitionRegex.exec(document.lineAt(endLine).text)) {
                            let text = document.lineAt(endLine).text.replace(/:/g, "")
                            text = (text.match(/[\.\w+]+/))[0]
                            let symbol = this.checkSymbol(text, document.uri, table.symbolDeclarations)
                            symbol.documentation = this.getDocumentation(document, endLine, symbol.kind)
                     }
                     const lineDiff = table.lineCount != document.lineCount
                     for (var symName in table.symbolDeclarations) {
                            const symLine = table.symbolDeclarations[symName].line
                            if (symLine >= startLine && symLine < deleteEndLine) {
                                   delete table.symbolDeclarations[symName];
                                   continue
                            }
                            if (lineDiff && table.symbolDeclarations[symName].line >= startLine) {
                                   table.symbolDeclarations[symName].line += document.lineCount - table.lineCount
                            }
                     }
                     for (let i = 0; i < table.reDefinitions.length; i++) {
                            if (table.reDefinitions[i].line >= startLine && table.reDefinitions[i].line < deleteEndLine) {
                                   table.reDefinitions.splice(i, 1)
                                   i--
                                   continue
                            }
                            if (lineDiff && table.reDefinitions[i].line >= startLine) {
                                   table.reDefinitions[i].line += document.lineCount - table.lineCount
                            }
                            if (table.reDefinitions[i].line > document.lineCount - 1 || table.reDefinitions[i].line < 0) {
                                   table.reDefinitions.splice(i, 1)
                                   i--
                                   continue
                            }
                     }
                     for (let i = 0; i < table.possibleRefs.length; i++) {
                            if (table.possibleRefs[i].line >= startLine && table.possibleRefs[i].line < deleteEndLine) {
                                   table.possibleRefs.splice(i, 1)
                                   i--
                                   continue
                            }
                            if (lineDiff && table.possibleRefs[i].line >= startLine) {
                                   table.possibleRefs[i].line += document.lineCount - table.lineCount
                            }
                            if (table.possibleRefs[i].line > document.lineCount - 1 || table.possibleRefs[i].line < 0) {
                                   table.possibleRefs.splice(i, 1)
                                   i--
                                   continue
                            }
                     }
                     for (let i = 0; i < table.includeFileLines.length; i++) {
                            let line = table.includeFileLines[i]
                            if (line >= startLine && line < deleteEndLine) {
                                   table.includeFileLines.splice(i, 1)
                                   table.includes.splice(i, 1)
                                   i--
                                   continue
                            }
                            if (lineDiff && line >= startLine) {
                                   table.includeFileLines[i] += document.lineCount - table.lineCount
                            }
                            if (line > document.lineCount - 1 || line < 0) {
                                   table.includeFileLines.splice(i, 1)
                                   table.includes.splice(i, 1)
                                   i--
                                   continue
                            }
                     }
                     const diagnosticsArray = table.diagnosticCollection.array
                     for (let i = 0; i < diagnosticsArray.length; i++) {
                            let range = diagnosticsArray[i].range
                            let diagLine = range.start.line
                            if (diagLine >= startLine && diagLine < deleteEndLine) {
                                   diagnosticsArray.splice(i, 1)
                                   i--
                                   continue
                            }
                            if (lineDiff && diagLine > startLine) {
                                   diagLine += document.lineCount - table.lineCount
                                   if (diagLine < 0) {
                                          diagnosticsArray.splice(i, 1)
                                          i--
                                          continue
                                   } else {
                                          diagnosticsArray[i].range = new vscode.Range(diagLine, range.start.character, diagLine, range.end.character)
                                   }
                            }
                     }
                     table.lineCount = document.lineCount
              } else {
                     table.lineCount = document.lineCount
              }
              this.documents[document.uri.fsPath] = table;
              for (let lineNumber = startLine; lineNumber < endLine; lineNumber++) {
                     const line = document.lineAt(lineNumber);
                     if (line.text.match(/(^\s*$)|(^:.*)/)) {
                            continue;
                     }
                     const commentLineMatch = commentLineRegex.exec(line.text);
                     if (commentLineMatch) {
                            continue;
                     }
                     const includeLineMatch = includeLineRegex.exec(line.text);
                     const labelMatch = labelDefinitionRegex.exec(line.text);
                     let nonCommentMatch = line.text.match(nonCommentRegex)
                     nonCommentMatch = nonCommentMatch[0].replace(/(\".+\")|(\'.+\')/g, "")
                     const wordmatch = nonCommentMatch.match(wordregex);
                     if (!line.text.match(/(^\s*\#)|(^\s*if)|(^\s*\.assume\s+adl)/i) && ((!labelMatch && !includeLineMatch) || (equateRegex.test(line.text)))) {
                            let char = 0
                            let startChar = 0
                            for (let index = 1; index < wordmatch.length; ++index) {
                                   if (!wordmatch[index].match(nonRegRegex)) {
                                          if (index == 1 && wordmatch[index].match(/\b(Z|NZ|C|NC|P|M|PO|PE)\b/i)) {
                                                 continue
                                          }
                                          startChar = nonCommentMatch.indexOf(wordmatch[index], char);
                                          const endChar = startChar + wordmatch[index].length
                                          const ref = new possibleRef(lineNumber, startChar, endChar, wordmatch[index], document.uri.fsPath)
                                          table.possibleRefs.push(ref)
                                   }
                                   char = startChar + wordmatch[index].length;
                            }
                     }
                     if (includeLineMatch) {
                            const filename = includeLineMatch[FILE_NAME];
                            let includeLineIndex = table.includeFileLines.indexOf(lineNumber)
                            if (includeLineIndex != -1) {
                                   table.includeFileLines.splice(includeLineIndex, 1)
                                   table.includes.splice(includeLineIndex, 1)
                            }
                            const fsRelativeDir = path.dirname(document.uri.fsPath);
                            const filePath = this._resolveFilename(filename, fsRelativeDir); // this also documents any included files
                            if (filePath === "") {
                                   continue
                            }
                            const includeUri = vscode.Uri.file(filePath);
                            if (table.includes.indexOf(includeUri.fsPath) == -1) {
                                   table.includes.push(includeUri.fsPath);
                                   table.includeFileLines.push(lineNumber)
                            }
                     } else if (labelMatch) {
                            const declaration = labelMatch[0];
                            if (declaration.match(/^\s*\.?(list|nolist|end)/)) { // these are directives, so they can't be labels
                                   continue
                            }
                            let kind = undefined;
                            if (declaration.indexOf(":") != -1) {
                                   kind = vscode.SymbolKind.Method;
                            } else if (equateRegex.test(line.text)) {
                                   kind = vscode.SymbolKind.Variable
                            }
                            const name = declaration.replace(/:/g, "");
                            let documentation = this.getDocumentation(document, lineNumber, kind);
                            const symbol = new SymbolDescriptor(lineNumber, kind == undefined ? vscode.SymbolKind.Function : kind, documentation, document.uri.fsPath, name);
                            if (this.checkSymbol(name, document.uri, table.symbolDeclarations)) {
                                   table.reDefinitions.push(symbol)
                                   continue
                            }
                            table.symbolDeclarations[name] = symbol
                     }
              }
              if (document.fileName.match(/.+\.inc/i)) {
                     table.possibleRefs = []
              }
       }
       /**
        * 
        * @param {vscode.TextDocument} document 
        * @param lineNumber 
        * @param kind 
        */
       getDocumentation(document, lineNumber, kind) {
              if (lineNumber == 0) {
                     return undefined
              }
              let line = document.lineAt(lineNumber);
              let documentation = undefined;
              let commentBuffer = [];
              const endCommentMatch = endCommentRegex.exec(line.text);
              if (endCommentMatch) {
                     commentBuffer.push(endCommentMatch[1]);
              }
              const trimmed = line.text.replace(/[\s]+/, " ");
              const withoutComment = trimmed.replace(/;.*$/, "");
              lineNumber--
              line = document.lineAt(lineNumber);
              let commentLineMatch = commentLineRegex.exec(line.text);
              while (commentLineMatch && commentLineMatch[1] && lineNumber >= 0) {
                     commentBuffer.unshift(commentLineMatch[1]);
                     lineNumber--
                     if (lineNumber >= 0) {
                            line = document.lineAt(lineNumber);
                            commentLineMatch = commentLineRegex.exec(line.text);
                     }
              }
              if (kind == vscode.SymbolKind.Variable) {
                     commentBuffer.unshift(withoutComment)
                     documentation = commentBuffer.join("\n")
              } else if (commentBuffer.length > 0) {
                     documentation = commentBuffer.join("\n\r");
              }
              return documentation;
       }
       _resolveFilename(filename, fsRelativeDir) {
              // Try just sticking the filename onto the directory.
              let simpleJoin = path.resolve(fsRelativeDir, filename);
              if (fs.existsSync(simpleJoin)) {
                     let includeUri = vscode.Uri.file(simpleJoin);
                     const table = this.documents[includeUri.fsPath]; // this.files is very picky
                     if (table == undefined) {
                            vscode.workspace.openTextDocument(includeUri).then((document) => {
                                   this.declareSymbols(document);
                            });
                     }
                     return simpleJoin;
              }
              // Grab the configured include paths. If it's a string, make it an array.
              var includePathConfiguration = vscode.workspace.getConfiguration().get("ez80-asm.includePath");
              if (typeof includePathConfiguration === "string") {
                     includePathConfiguration = [includePathConfiguration];
              }
              // For each configured include path
              for (var i = 0; i < includePathConfiguration.length; i++) {
                     var includePath = includePathConfiguration[i];
                     // If the path is relative, make it absolute starting from workspace root.
                     if (path.isAbsolute(includePath) == false) {
                            if (vscode.workspace.workspaceFolders !== undefined) {
                                   includePath = path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, includePath);
                            }
                     }
                     // Test for existence of the filename glued onto the include path.
                     var joined = path.resolve(includePath, filename);
                     if (fs.existsSync(joined)) {
                            let includeUri = vscode.Uri.file(joined);
                            const table = this.documents[includeUri.fsPath]; // this.files is very picky
                            if (table == undefined) {
                                   vscode.workspace.openTextDocument(includeUri).then((document) => {
                                          this.declareSymbols(document);
                                   });
                            }
                            return joined;
                     }
              }
              // Nothing found, return the empty string.
              return "";
       }
       /**
        * 
        * @param {vscode.TextDocument} document 
        */
       writeTableToFile(document) {
              const docTable = this.documents[document.uri.fsPath]
              const json = JSON.stringify(docTable)
              const base = path.basename(document.fileName)
              const cachePath = path.join(this.cacheFolder, base + ".json");
              fs.writeFile(cachePath, json, (error) => {
                     if (error) {
                            console.log(error.message)
                     }
              })
       }
       /**
        * 
        * @param {String} fsPath 
        */
       readTableFromFile(fsPath) {
              const base = path.basename(fsPath)
              const cachePath = path.join(this.cacheFolder, base + ".json");
              if (!fs.existsSync(cachePath)) {
                     return null
              }
              const fileStats = fs.statSync(fsPath)
              const table = JSON.parse(fs.readFileSync(cachePath, "utf8"));
              for (let i = 0; i < table.possibleRefs.length; i++) {
                     const ref = table.possibleRefs[i]
                     table.possibleRefs[i] = new possibleRef(ref.line, ref.startChar, ref.endChar, ref.text, table.fsPath)
              }
              table.fullArray = () => {
                     return this.diagnosticCollection.array.concat(this.diagnosticCollection.symarray.concat(this.diagnosticCollection.redefArray))
              }
              if (table && table.fsPath == fsPath && table.lastModified == fileStats.mtimeMs) {
                     this.documents[fsPath] = table
                     const diagnostics = vscode.languages.createDiagnosticCollection();
                     diagnostics.array = table.diagnosticCollection.array
                     diagnostics.symarray = table.diagnosticCollection.symarray
                     diagnostics.redefArray = table.diagnosticCollection.redefArray
                     table.diagnosticCollection = diagnostics
                     for (let i = 0; i < table.includes.length; i++) {
                            this.readTableFromFile(table.includes[i])
                     }
              }
       }
       /**
        * 
        * @param {vscode.Uri} uri 
        * @param {[]} searched 
        * @param {{}} output 
        */
       getAvailableSymbols(uri, searched, output) {
              if (!output || !searched) {
                     searched = []
                     output = {}
              }
              let table = this.documents[uri.fsPath]
              searched.push(uri.fsPath)
              for (var name in table.symbolDeclarations) { // search the current fsPath
                     output[name] = table.symbolDeclarations[name]
              }
              for (let i = 0; i < table.includes.length; i++) { // search included files
                     if (searched.indexOf(table.includes[i]) == -1) {
                            const includeUri = vscode.Uri.file(table.includes[i])
                            this.getAvailableSymbols(includeUri, searched, output)
                     }
              }
              for (var docPath in this.documents) { // search files that include this one
                     table = this.documents[docPath]
                     for (let i = 0; i < table.includes.length; i++) {
                            if (table.includes[i] === uri.fsPath && searched.indexOf(docPath) == -1) {
                                   const docUri = vscode.Uri.file(docPath)
                                   this.getAvailableSymbols(docUri, searched, output)
                            }
                     }
              }
              return output
       }
       checkSymbol(name, uri, symbols) {
              if (!symbols) {
                     symbols = this.getAvailableSymbols(uri)
              }
              if (vscode.workspace.getConfiguration().get("ez80-asm.caseInsensitive")) {
                     return symbols[Object.keys(symbols).find(key => key.toLowerCase() === name.toLowerCase())]
              } else {
                     return symbols[name]
              }
       }

}
exports.symbolDocumenter = symbolDocumenter
exports.SymbolDescriptor = SymbolDescriptor
exports.possibleRef = possibleRef
exports.DocumentTable = DocumentTable