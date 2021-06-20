const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const HashTable = (require("./HashTable")).HashTable
const regexs = require("./regexs")

class SymbolDescriptor {
      constructor(kind, documentation, fsPath, name, line) {
            this.kind = kind
            this.documentation = documentation
            this.fsPath = fsPath
            this.name = name
            this.line = line
      }
}
class CasedHashTable extends HashTable {
      constructor(capacity) {
            super(capacity)
      }
      set(key, value) {
            return super.set(changeCase(key), value)
      }
      get(key) {
            return super.get(changeCase(key))
      }
      has(key) {
            return super.has(changeCase(key))
      }
      delete(key, lineNumber) {
            return super.delete(changeCase(key), lineNumber)
      }

}

class Include {
      constructor(fsPath, line, parent) {
            this.fsPath = fsPath
            this.line = line
            this.parent = parent
      }
}

class DocumentTable {
      constructor(fsPath) {
            this.lastModified = (fs.statSync(fsPath)).mtimeMs
            this.collection = vscode.languages.createDiagnosticCollection()
            this.fsPath = fsPath
            this.lines = []
            this.includes = new HashTable()
            this.symbols = new CasedHashTable()
            this.refs = new CasedHashTable()
            this.parents = []
      }
}
class Line {
      /**
       * 
       * @param {String} text 
       * @param {Number} lineNumber
       */
      constructor(text, lineNumber) {
            this.text = text
            this.lineNumber = lineNumber
      }
}
exports.symbolDocumenter = class {
      /**
       * 
       * @param {vscode.ExtensionContext} context 
       */
      constructor(context) {
            this.context = context
            this.extensionPath = this.context.extensionPath
            this.cacheFolder = path.join(this.extensionPath, "/caches")
            this.docTables = {}
            this.regexs = {}
      }
      /**
       * 
       * @param {String} documentText
       * @param {String} fsPath
       * @param {vscode.TextDocumentChangeEvent} event 
       */
      scan(documentText, fsPath, event) {
            try {
                  let docTable
                  let startLine
                  let endLine
                  const textArray = documentText.split(/\r\n|\r|\n/)
                  const lineCount = textArray.length
                  if (event) {
                        docTable = this.docTables[fsPath]
                        if (event.contentChanges.length == 0) {
                              return
                        } else if (event.contentChanges.length > 1) {
                              for (let i = 0; i < event.contentChanges.length; i++) {
                                    const pseudoEvent = {}
                                    pseudoEvent.contentChanges = []
                                    pseudoEvent.contentChanges.push(event.contentChanges[i])
                                    this.scan(documentText, fsPath, pseudoEvent)
                              }
                        } else {
                              const change = event.contentChanges[0]
                              startLine = change.range.start.line
                              if (change.rangeLength == 0) { // insertion, rangeLength = 0, text = new text
                                    endLine = startLine + (lineCount - docTable.lines.length) + 1 // line diff is always >= 0 in insertion
                                    this.removeLines(docTable, startLine, 1)
                              } else { // substitution, rangeLength > 0, text = new text, deletion is basically the same but text =''
                                    endLine = change.range.end.line + 1 - Math.abs(docTable.lines.length - lineCount)
                                    this.removeLines(docTable, startLine, change.range.end.line - startLine + 1)
                              }
                        }
                  } else {
                        // TODO make sure the file isn't cached
                        docTable = new DocumentTable(fsPath)
                        this.docTables[fsPath] = docTable
                        startLine = 0
                        endLine = lineCount
                  }
                  for (let lineNumber = startLine; lineNumber < endLine; lineNumber++) {
                        const lineText = textArray[lineNumber]
                        const line = new Line(lineText, lineNumber)
                        if (event) {
                              docTable.lines.splice(lineNumber, 0, line)
                        } else {
                              docTable.lines.push(line)
                        }
                        if (lineText.match(/^\s*$/)) {
                              continue
                        }
                        if (lineText.match(/^\s*;.*$/)) {
                              if (lineNumber == endLine && endLine < lineCount) { // For function documentation purposes
                                    endLine++
                              }
                              continue
                        }
                        let match
                        if (match = this.regexs.includeLineRegex.exec(lineText)) { // assignment and check if value is not null/undefined
                              const fileName = match[1]
                              const fsRelativeDir = path.dirname(fsPath);
                              const includefsPath = this.scanInclude(fileName, fsRelativeDir, fsPath); // this also documents any included files
                              if (includefsPath === "") {
                                    continue
                              }
                              line.include = includefsPath
                              docTable.includes.set(includefsPath, new Include(includefsPath, line, fsPath))
                        } else if (match = this.regexs.equateRegex.exec(lineText)) {
                              const kind = vscode.SymbolKind.Variable;
                              const name = match[0]
                              this.addSymbol(name, kind, textArray, line, fsPath, docTable.symbols)
                        } else if (match = this.regexs.labelRegex.exec(lineText)) {
                              let kind
                              if (lineText.match(/^\S+\:/)) {
                                    kind = vscode.SymbolKind.Method
                              } else {
                                    kind = vscode.SymbolKind.Function
                              }
                              const name = match[0]
                              this.addSymbol(name, kind, textArray, line, fsPath, docTable.symbols)
                        }
                        let formattedText = lineText.replace(/^\S+/, "").replace(/;.*$/, "").replace(/\".+\"|\'.+\'/, "1").replace(/\s+/g, " ").trim()
                        const regularLine = lineText.match(/^\s*(\#|\.)/)
                        if (!regularLine) {
                              if (match = lineText.match(this.regexs.equateRegex)) {
                                    formattedText = formattedText.replace(/equ/i, "")
                              } else {
                                    let instructionLineText = formattedText.toLowerCase()
                                    try {
                                          line.opcode = (instructionLineText.match(/^\w+/))[0]
                                    } catch (error) { // just a label line
                                          continue
                                    }
                                    formattedText = formattedText.replace(/^\w+\s*/, "")
                                    instructionLineText = instructionLineText.replace(/^\w+\s*/, "")
                                    line.operands = instructionLineText.split(",")
                              }
                        } else {
                              formattedText = formattedText.replace(/^\s*(\#|\.)\w+/, "")
                        }
                        const refs = formattedText.replace(this.regexs.numberRegex, "").replace(this.regexs.registerRegex, "").replace(this.regexs.conditionalRegex, "").replace(this.regexs.nonRefRegex, "").match(/[\w\.]+/g)
                        if (refs) {
                              line.refs = refs
                              for (let i = 0; i < refs.length; i++) {
                                    const oldArray = docTable.refs.get(refs[i])
                                    if (!oldArray) {
                                          docTable.refs.set(refs[i], [line])
                                    } else {
                                          oldArray.push(line)
                                    }
                              }
                        }
                  }
                  for (let i = 0; i < docTable.lines.length; i++) { // a crude way of updating linenumbers
                        docTable.lines[i].lineNumber = i
                  }
                  // end of scan
            } catch (error) {
                  if (!this.type) { // an error is guaranteed when extension starts up
                        let type = vscode.workspace.getConfiguration("ez80-asm").get("type")
                        if (fsPath.endsWith(".ez80")) {
                              this.type = "ez80"
                        } else if (type) {
                              this.type = type
                        } else {
                              this.type = "z80"
                        }
                        this.regexs = regexs[this.type]
                        this.scan(documentText, fsPath)
                  }
                  console.log(error.message)
            }
      }
      /**
       * 
       * @param {DocumentTable} docTable 
       * @param {number} startIndex 
       * @param {number} deleteCount 
       */
      removeLines(docTable, startIndex, deleteCount) {
            for (let count = 0; count < deleteCount; count++) {
                  const line = docTable.lines[count + startIndex]
                  if (line.include) {
                        docTable.includes.delete(line.include)
                        const parentArray = this.docTables[line.include].parents
                        const index = parentArray.indexOf(docTable.fsPath)
                        parentArray.splice(index, 1)
                  }
                  if (line.symbol) {
                        docTable.symbols.delete(line.symbol.name)
                  }
                  if (line.refs) {
                        for (let i = 0; i < line.refs.length; i++) {
                              docTable.refs.delete(line.refs[i], line.lineNumber)
                        }
                  }
            }
            docTable.lines.splice(startIndex, deleteCount)
      }
      /**
       * 
       * @param {String} name 
       * @param {vscode.SymbolKind} kind 
       * @param {String[]} textArray 
       * @param {Line} line 
       * @param {String} fsPath 
       * @param {*} symbolHashTable
       */
      addSymbol(name, kind, textArray, line, fsPath, symbolHashTable) {
            const documentation = this.getDocumentation(textArray, line.lineNumber, kind)
            const symbol = new SymbolDescriptor(kind, documentation, fsPath, changeCase(name), line)
            if (symbolHashTable.set(name, symbol)) {
                  line.symbol = symbol
            }
      }
      /**
        * 
        * @param {string[]} textArray
        * @param lineNumber 
        * @param kind 
        */
      getDocumentation(textArray, lineNumber, kind) {
            if (lineNumber == 0) {
                  return undefined
            }
            let lineText = textArray[lineNumber]
            let documentation = undefined;
            let commentBuffer = [];
            const endCommentMatch = this.regexs.endCommentRegex.exec(lineText);
            if (endCommentMatch) {
                  commentBuffer.push(endCommentMatch[1]);
            }
            const trimmed = lineText.replace(/[\s]+/, " ");
            const withoutComment = trimmed.replace(/;.*$/, "");
            lineNumber--
            lineText = textArray[lineNumber];
            let commentLineMatch = this.regexs.commentLineRegex.exec(lineText);
            while (commentLineMatch && commentLineMatch[1] && lineNumber >= 0) {
                  commentBuffer.unshift(commentLineMatch[1]);
                  lineNumber--
                  if (lineNumber >= 0) {
                        lineText = textArray[lineNumber]
                        commentLineMatch = this.regexs.commentLineRegex.exec(lineText);
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
      scanInclude(filename, fsRelativeDir, parentfsPath) {
            const fsPath = this.resolveFilename(filename, fsRelativeDir)
            if (fsPath !== "") {
                  const includeUri = vscode.Uri.file(fsPath);
                  const table = this.docTables[includeUri.fsPath];
                  if (table == undefined) {
                        const text = fs.readFileSync(includeUri.fsPath, "utf-8")
                        this.scan(text, includeUri.fsPath)
                  }
                  const parentArray = this.docTables[includeUri.fsPath].parents
                  if (!parentArray.includes(parentfsPath)) {
                        parentArray.push(parentfsPath)
                  }
            }
            return fsPath
      }
      /**
       * I believe I adapted this from Donald Hays' RGBDZ Z80 extension
       * @param {String} filename 
       * @param {String} fsRelativeDir 
       * @returns {String} fsPath to the file, otherwise ""
       */
      resolveFilename(filename, fsRelativeDir) {
            // Try just sticking the filename onto the directory.
            let simpleJoin = path.resolve(fsRelativeDir, filename);
            if (fs.existsSync(simpleJoin)) {
                  return vscode.Uri.file(simpleJoin).fsPath
            }
            // Grab the configured include paths. If it's a string, make it an array.
            var includePathConfiguration = vscode.workspace.getConfiguration("ez80-asm").get("includePath");
            if (typeof includePathConfiguration === "string") {
                  includePathConfiguration = [includePathConfiguration];
            }
            // For each configured include path
            for (var i = 0; i < includePathConfiguration.length; i++) {
                  var includePath = includePathConfiguration[i];
                  // If the path is relative, make it absolute starting from workspace root.
                  if (path.isAbsolute(includePath) == false) {
                        if (vscode.workspace.workspaceFolders) {
                              includePath = path.resolve(fsRelativeDir, includePath);
                        }
                  }
                  // Test for existence of the filename glued onto the include path.
                  var joined = path.resolve(includePath, filename);
                  if (fs.existsSync(joined)) {
                        return vscode.Uri.file(joined).fsPath;
                  }
            }
            // Nothing found, return the empty string.
            return "";
      }
      /**
       * 
       * @param {string} fsPath 
       * @param {string} name 
       * @returns the symbol if found
       */
      getSymbolAndPath(name, fsPath) {
            try {
                  this.getSymbolAndPathrecurse(name, [], false, fsPath)
            } catch (symbol) {
                  return symbol
            }
      }
      /**
       * 
       * @param {String} name 
       * @param {String[]} searched 
       * @param {boolean} noSearchParent 
       * @param {String} fsPath 
       * @throws the symbol
       */
      getSymbolAndPathrecurse(name, searched, noSearchParent, fsPath) {
            const docTable = this.docTables[fsPath]
            let symbol = docTable.symbols.get(name)
            if (!searched) {
                  searched = [fsPath]
            } else {
                  searched.push(fsPath)
            }
            if (symbol) {
                  throw [symbol, searched.pop()]
            }
            this.includeSearch(docTable, searched, this.getSymbolAndPathrecurse, [name, searched, true])
            this.parentSearch(docTable, noSearchParent, searched, this.getSymbolAndPathrecurse, [name, searched, false])
      }
      /**
       * 
       * @param {String} name 
       * @param {vscode.Location[]} output 
       * @param {String[]} searched 
       * @param {boolean} noSearchParent 
       * @param {String} fsPath 
       * @returns {vscode.Location[]}
       */
      getAllRefLocationsrecurse(name, output, searched, noSearchParent, fsPath) {
            const docTable = this.docTables[fsPath]
            let refArray = docTable.refs.get(name)
            if (!searched) {
                  output = []
                  searched = [fsPath]
            } else {
                  searched.push(fsPath)
            }
            if (refArray) {
                  for (let i = 0; i < refArray.length; i++) {
                        output.push(this.getLocation(name, fsPath, refArray[i]))
                  }
            }
            this.includeSearch(docTable, searched, this.getAllRefLocationsrecurse, [name, output, searched, true])
            this.parentSearch(docTable, noSearchParent, searched, this.getAllRefLocationsrecurse, [name, output, searched, false])
            return output

      }
      /**
       * 
       * @param {vscode.SymbolInformation[]} output 
       * @param {String[]} searched 
       * @param {boolean} noSearchParent 
       * @param {String} fsPath 
       * @returns {vscode.SymbolInformation[]}
       */
      workspaceSymbolsrecurse(output, searched, noSearchParent, fsPath) {
            const docTable = this.docTables[fsPath]
            const symbols = docTable.symbols.getTable()
            for (let i = 0; i < symbols.length; i++) {
                  const symbol = symbols[i].value
                  const location = this.getLocation(symbol.name, fsPath, symbol.line)
                  output.push(new vscode.SymbolInformation(symbol.name, symbol.kind, undefined, location));
            }
            searched.push(fsPath)
            this.includeSearch(docTable, searched, this.workspaceSymbolsrecurse, [output, searched, true])
            this.parentSearch(docTable, noSearchParent, searched, this.workspaceSymbolsrecurse, [output, searched, false])
            return output
      }
      getLocation(name, fsPath, line) {
            const range = this.getRange(name, line)
            const uri = vscode.Uri.file(fsPath)
            return new vscode.Location(uri, range)
      }
      /**
       * 
       * @param {DocumentTable} docTable 
       * @param {String[]} searched 
       * @param {Function} func 
       * @param {[]} args 
       */
      includeSearch(docTable, searched, func, args) {
            const index = args.length
            args.push(null)
            const includeTable = docTable.includes.getTable()
            if (includeTable.length > 0) {
                  for (let i = 0; i < includeTable.length; i++) {
                        if (!searched.includes(includeTable[i].key)) {
                              args[index] = includeTable[i].key
                              func.apply(this, args)
                        }
                  }
            }
      }
      /**
       * 
       * @param {DocumentTable} docTable 
       * @param {boolean} noSearchParent 
       * @param {String[]} searched 
       * @param {Function} func 
       * @param {[]} args 
       */
      parentSearch(docTable, noSearchParent, searched, func, args) {
            const index = args.length
            args.push(null)
            if (noSearchParent) {
                  return
            } else {
                  for (let i = 0; i < docTable.parents.length; i++) {
                        if (!searched.includes(docTable.parents[i])) {
                              args[index] = docTable.parents[i]
                              func.apply(this, args)
                        }
                  }
            }
      }
      checkSymbol(name, fsPath) {
            const array = this.getSymbolAndPath(name, fsPath)
            if (array) {
                  return array[0]
            } else {
                  return undefined
            }
      }
      /**
       * 
       * @param {String} name 
       * @param {Line} line 
       * @returns {vscode.Range}
       */
      getRange(name, line) {
            let startChar
            if (vscode.workspace.getConfiguration("ez80-asm").get("caseInsensitive")) {
                  startChar = line.text.toLowerCase().indexOf(name)
            } else {
                  startChar = line.text.indexOf(name)
            }
            const endChar = startChar + name.length
            return new vscode.Range(line.lineNumber, startChar, line.lineNumber, endChar)
      }
}
function changeCase(key) {
      if (vscode.workspace.getConfiguration("ez80-asm").get("caseInsensitive")) {
            return key.toLowerCase()
      } else {
            return key
      }
}