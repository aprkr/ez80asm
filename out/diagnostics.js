'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const imports = require("./imports")
const path = require("path");
const includeLineRegex = /^\s*\#?(include)[\W]+"([^"]+)".*$/i;
const labelDefinitionRegex = /^((([a-zA-Z_][a-zA-Z_0-9]*)?\.)?[a-zA-Z_][a-zA-Z_0-9]*[:]{0,2}).*$/;
const wordregex = /([\w\.]+(\.\w+)?(\.|\b))/g
const numberRegex = /((\$|0x)[0-9a-fA-F]+\b)|(\b[0-9a-fA-F]+h\b)|(%[01]+\b)|(\b[01]+b\b)|(\b[0-9]+d?\b)/g
const firstoperandregex = /^\s*[\w\.]+\s+([^\,\r\n\f\v]+)/
const secondoperandregex = /^.*?,\s*(.*)/
const nonCommentRegex = /^([^;]+[^\,\r\n\t\f\v ;])/g
const opcodeRegex = /\b(ADC|ADD|CP|DAA|DEC|INC|MLT|NEG|SBC|SUB|BIT|RES|SET|CPD|CPDR|CPI|CPIR|LDD|LDDR|LDI|LDIR|EX|EXX|IN|IN0|IND|INDR|INDRX|IND2|IND2R|INDM|INDMR|INI|INIR|INIRX|INI2|INI2R|INIM|INIMR|OTDM|OTDMR|OTDRX|OTIM|OTIMR|OTIRX|OUT|OUT0|OUTD|OTDR|OUTD2|OTD2R|OUTI|OTIR|OUTI2|OTI2R|TSTIO|LD|LEA|PEA|POP|PUSH|AND|CPL|OR|TST|XOR|CCF|DI|EI|HALT|IM|NOP|RSMIX|SCF|SLP|STMIX|CALL|DJNZ|JP|JR|RET|RETI|RETN|RST|RL|RLA|RLC|RLCA|RLD|RR|RRA|RRC|RRCA|RRD|SLA|SRA|SRL)\b/i;
const noOperandOpcodeRegex = /\b(DAA|NEG|CPD|CPDR|CPI|CPIR|LDD|LDDR|LDI|LDIR|EXX|IND|INDR|INDRX|IND2|IND2R|INDM|INDMR|INI|INIR|INIRX|INI2|INI2R|INIM|INIMR|OTDM|OTDMR|OTDRX|OTIM|OTIMR|OTIRX|OUTD|OTDR|OUTD2|OTD2R|OUTI|OTIR|OUTI2|OTI2R|CCF|DI|EI|HALT|NOP|RSMIX|SCF|SLP|STMIX|RETI|RETN|RLA|RLCA|RRA|RRCA|RRD)\b/i;
const suffixRegex = /(\.)(LIL|LIS|SIL|SIS|L|S)\b/i;
const todoRegex = /.*;\s*todo\b:?\s*(.*)/i

/**
 * This does a lot, scans table.possibleRefs, checks if opcodes/operands are correct, checks for duplicate declarations
 */
class diagnosticProvider {
       /**
        * @param {imports.symbolDocumenter} symbolDocumenter 
        * @param {imports.ASMCompletionProposer} completionProposer 
        */
       constructor(symbolDocumenter, completionProposer) {
              this.symbolDocumenter = symbolDocumenter
              this.instructionItemsFull = completionProposer.instructionItemsNonForm
       }
       /**
        * @param {vscode.TextDocument} document 
        * @param {imports.DocumentTable} table 
        */
       scanRefs(document, table) {
              if (!table) {
                     table = this.symbolDocumenter.documents[document.uri.fsPath]
              }
              let collection = table.diagnosticCollection
              collection.clear()
              let array = []
              const symbols = this.symbolDocumenter.getAvailableSymbols(document.uri)
              for (let i = 0; i < table.possibleRefs.length; i++) {
                     if (!this.symbolDocumenter.checkSymbol(table.possibleRefs[i].text, document.uri, symbols)) {
                            array.push(new vscode.Diagnostic(table.possibleRefs[i].range, "Bad symbol"));
                     }
              }
              collection.symarray = array
              if (vscode.workspace.getConfiguration().get("ez80-asm.diagnosticProvider")) {
                     collection.set(document.uri, table.fullArray)
              }
       }
       /**
        * @param {vscode.TextDocument} document 
        * @param {vscode.TextDocumentChangeEvent} event 
        */
       getDiagnostics(document, event) {
              if (document.fileName.match(/^.+\.inc$/)) {
                     return
              }
              if (event && event.contentChanges.length > 1) {
                     for (let i = 1; i < event.contentChanges.length; i++) {
                            const pseudoEvent = {}
                            pseudoEvent.contentChanges = []
                            pseudoEvent.contentChanges.push(event.contentChanges[i])
                            this.getDiagnostics(document, pseudoEvent)
                     }
              }
              const table = this.symbolDocumenter.documents[document.uri.fsPath]
              let collection = table.diagnosticCollection
              const symbols = this.symbolDocumenter.getAvailableSymbols(document.uri)
              collection.redefArray = []
              for (let i = 0; i < table.reDefinitions.length; i++) {
                     const definition = this.symbolDocumenter.checkSymbol(table.reDefinitions[i].name, table.reDefinitions[i].uri, symbols)
                     if (!definition) {
                            table.symbolDeclarations[table.reDefinitions[i].name] = table.reDefinitions[i]
                            table.reDefinitions.splice(i, 1)
                            i--
                            continue
                     } else if (definition.line > table.reDefinitions[i].line) {
                            table.symbolDeclarations[table.reDefinitions[i].name] = table.reDefinitions[i]
                            table.reDefinitions[i] = definition
                     } else {
                            const position = new vscode.Position(table.reDefinitions[i].line, 0)
                            let range = document.getWordRangeAtPosition(position, /[\w\.]+/g)
                            let text = document.getText(range)
                            if (text !== table.reDefinitions[i].name) {
                                   table.reDefinitions.splice(i, 1)
                                   i--
                                   continue
                            }
                     }
                     const range = new vscode.Range(table.reDefinitions[i].line, 0, table.reDefinitions[i].line, table.reDefinitions[i].name.length)
                     let diag = new vscode.Diagnostic(range, "Redefinition of " + table.reDefinitions[i].name.toUpperCase(), vscode.DiagnosticSeverity.Warning)
                     collection.redefArray.push(diag)
              }
              this.scanRefs(document, table)
              let diagnosticsArray = collection.array
              let startLine = 0
              let endLine = document.lineCount
              if (event) {
                     startLine = event.contentChanges[0].range.start.line
                     endLine = event.contentChanges[0].range.end.line + 1
                     const newLinematch = event.contentChanges[0].text.match(/\n/g)
                     if (newLinematch) {
                            endLine += newLinematch.length
                     } else if (table.lineCount > document.lineCount && event.contentChanges[0].text === "") {
                            endLine = startLine + 1
                     }  
              }
              for (let lineNumber = startLine; lineNumber < endLine; lineNumber++) {
                     const line = document.lineAt(lineNumber)
                     let diags = this.getLineDiagnostics(line.text, lineNumber, symbols, document, collection.symarray)
                     if (diags && diags.length > 0) {
                            for (let i = 0; i < diags.length; i++) {
                                   diagnosticsArray.push(diags[i])
                            }
                     }
              }
              collection.array = diagnosticsArray
              if (vscode.workspace.getConfiguration().get("ez80-asm.diagnosticProvider")) {
                     collection.set(document.uri, table.fullArray)
              }
       }
       /**
        * 
        * @param {String} text 
        * @param {Number} lineNumber 
        * @param {{}} symbols 
        * @param {vscode.TextDocument} document 
        * @param {[]} symarray 
        */
       getLineDiagnostics(text, lineNumber, symbols, document, symarray) {
              let diagnosticsArray = []
              if (text === "") {
                     return;
              }
              const todoMatch = text.match(todoRegex)
              if (todoMatch) {
                     const range = new vscode.Range(lineNumber, 0, lineNumber, text.length)
                     diagnosticsArray.push(new vscode.Diagnostic(range, "TODO: " + todoMatch[1], vscode.DiagnosticSeverity.Information))
              }
              const includeLineMatch = includeLineRegex.exec(text);
              let nonCommentMatch = text.match(nonCommentRegex)
              const labelMatch = text.match(labelDefinitionRegex)
              if (nonCommentMatch) {
                     nonCommentMatch = nonCommentMatch[0].replace(/\".+\"/g, "")
                     if (!labelMatch) {
                            if (includeLineMatch) {
                                   const filename = includeLineMatch[2];
                                   const fsRelativeDir = path.dirname(document.uri.fsPath);
                                   if (this.symbolDocumenter._resolveFilename(filename, fsRelativeDir) === "") {
                                          const endChar = includeLineMatch[0].length;
                                          const range = new vscode.Range(lineNumber, 0, lineNumber, endChar)
                                          diagnosticsArray.push(new vscode.Diagnostic(range, "File not found"));
                                   }
                                   return diagnosticsArray;
                            }
                            const textLength = nonCommentMatch.length
                            let diagline = nonCommentMatch
                            diagline = diagline.replace(numberRegex, "number");
                            const diagwordmatch = diagline.match(wordregex);
                            let opcodeskip = false
                            let invalid = true
                            if (!diagline.match(/^\s*(\#|\.|db|dw|dl)/gi)) {      // check the opcode
                                   const startChar = text.indexOf(diagwordmatch[0])
                                   const endChar = startChar + diagwordmatch[0].length
                                   if (diagwordmatch[0].indexOf(".") != -1 && !diagwordmatch[0].match(suffixRegex)) {       // if the suffix isn't valid
                                          const range = new vscode.Range(lineNumber, startChar, lineNumber, endChar)
                                          diagnosticsArray.push(new vscode.Diagnostic(range, "Bad suffix"));
                                   } else if (diagwordmatch[0].indexOf(".") != -1) {
                                          diagline = diagline.replace(/\.\w+/, "")  // remove the suffix from the test line if it's valid
                                   }
                                   if (!diagwordmatch[0].match(opcodeRegex)) {        // if the opcode isn't valid
                                          const range = new vscode.Range(lineNumber, startChar, lineNumber, endChar)
                                          diagnosticsArray.push(new vscode.Diagnostic(range, "Unknown ez80 opcode"));
                                          return diagnosticsArray;
                                   } else if (diagwordmatch[0].match(noOperandOpcodeRegex)) { // if the opcode doesn't use an operand
                                          if (diagwordmatch.length > 1) {     
                                                 const range = new vscode.Range(lineNumber, startChar, lineNumber, endChar)
                                                 diagnosticsArray.push(new vscode.Diagnostic(range, "No operand needed for this opcode"));
                                                 return diagnosticsArray;
                                          } else {
                                                 opcodeskip = true    // ret
                                          }
                                   }
                            } else {
                                   opcodeskip = true
                            }
                            if (!opcodeskip) {
                                   for (let i = 1; i < diagwordmatch.length; i++) {    // replace all the symbols with "number"
                                          if (this.symbolDocumenter.checkSymbol(diagwordmatch[i], document.uri, symbols)) {
                                                 diagline = diagline.replace(diagwordmatch[i], "number")
                                          }
                                   }
                                   diagline = this.formatLine(diagline);
                                   let operands = this.getOperands(diagline);
                                   diagline = diagline.replace(/(.+)/g, function (match) {
                                          const opcode = match.match(/^\s+(\w+)/)
                                          for (let i = 0; i < operands.length; i++) {
                                                 operands[i] = operands[i].replace(/ /g, "")
                                          }
                                          if (operands.length == 1) {
                                                 return opcode[1] + " " + operands[0]
                                          } else if (operands.length == 2) {
                                                 return opcode[1] + " " + operands[0] + ", " + operands[1]
                                          } else if (operands.length == 0) {
                                                 return opcode[1]
                                          } else {
                                                 return match
                                          }
                                   })
                                   diagline = this.evalOperands(diagline, operands)
                                   invalid = this.testLine(diagline)
                                   if (invalid) {
                                          const endChar = textLength;
                                          const range = new vscode.Range(lineNumber, 0, lineNumber, endChar)
                                          for (let i = 0; i < symarray.length; i++) {
                                                 if (symarray[i].range.intersection(range)) {
                                                        return diagnosticsArray
                                                 }
                                          }
                                          diagnosticsArray.push(new vscode.Diagnostic(range, "Bad operands"));
                                   }
                            }
                     }
              }
              return diagnosticsArray
       }
       formatLine(line) {
              line = line.toLowerCase();
              line = line.replace(/\'.+\'/, "number")
              line = line.replace(/(ix|iy)\s*(\+|-|\/|\*)\s*/gi, "ix+")
              line = line.replace(/\[/g, "(")
              line = line.replace(/\]/g, ")")
              return line
       }
       getOperands(line) {
              let operands = []
              let operand = line.match(firstoperandregex)
              if (operand) {
                     operands.push(operand[1])
              }
              operand = line.match(secondoperandregex)
              if (operand) {
                     operands.push(operand[1])
              }
              return operands
       }
       testLine(line) {
              line = line.replace(/(ix|iy)\+valid/gi, "ix+d")
              if (this.instructionItemsFull.indexOf(line) != -1) {
                     return false
              }
              let test = line.replace(/\bvalid\b/g, "mmn")
              if (this.instructionItemsFull.indexOf(test) != -1) {
                     return false
              }
              test = line.replace(/\bvalid\b/g, "n")
              if (this.instructionItemsFull.indexOf(test) != -1) {
                     return false
              }
              test = line.replace(/\bvalid\b/g, "bit")
              if (this.instructionItemsFull.indexOf(test) != -1) {
                     return false
              }
              return true
       }
       evalOperands(line, operands) {
              for (let i = 0; i < operands.length; i++) {
                     try {
                            eval(operands[i].replace(/\b(number|((ix|iy)(?=\+)))/gi, 1))
                            let withoutParen = operands[i].match(/(?<=^\()(.*)(?=\)$)/)
                            if (!withoutParen) {
                                   withoutParen = [operands[i]]
                            }
                            withoutParen[0] = withoutParen[0].replace(/(ix|iy)\+/i, "")
                            line = line.replace(withoutParen[0], "valid")
                     } catch (err) {
                     }
              }
              return line
       }
}
exports.diagnosticProvider = diagnosticProvider
