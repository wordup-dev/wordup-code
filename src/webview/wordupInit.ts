
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { getOutputChannel } from '../utils';
const slugify = require('slugify');


interface ProjectInitFields {
	name: string; 
	path:string;
	type:string;
	title:string;
	admin:string;
    password:string;
    email:string;
    plugins:object;
}


export class WordupInitWebView {
    public panel:vscode.WebviewPanel;
	private readonly _extensionPath: string;

    constructor(context: vscode.ExtensionContext){
        this._extensionPath = context.extensionPath;

        this.panel = vscode.window.createWebviewPanel(
            'wordupInit', // Identifies the type of the webview. Used internally
            'New wordup project', // Title of the panel displayed to the user
            vscode.ViewColumn.One, // Editor column to show the new webview panel in.
            {
                enableScripts: true
            } // Webview options. More on these later.
        );

        this.getWebviewContent();

        this.panel.webview.onDidReceiveMessage(
            message => {
              switch (message.command) {
                case 'submitForm':
                  this.actionSubmitForm(message.value);
                  return;
                case 'selectFolder':
                  this.actionSelectFolder();
                  return;
              }
            },
            undefined,
            context.subscriptions
        );

    }

    actionSubmitForm(fields:ProjectInitFields){

        if (!fs.existsSync(fields.path)) {
			vscode.window.showErrorMessage('The selected path does not exist.');
            return;
		}

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Create new wordup project",
            cancellable: true
        }, (progress, token) => {

            progress.report({ increment: 5 });

            setTimeout(() => progress.report({ increment: 15 }), 1000);
            setTimeout(() => progress.report({ increment: 15 }), 2000);
            setTimeout(() => progress.report({ increment: 15 }), 4000);
            setTimeout(() => progress.report({ increment: 10 }), 8000);
            setTimeout(() => progress.report({ increment: 5, message: " 💤" }), 16000);

            return new Promise(resolve => {
                getOutputChannel().clear();
			    getOutputChannel().show(true);

                let env = Object.create( process.env );
                env.WORDUP_INIT_PATH = fields.path;
                env.WORDUP_INIT_NAME = fields.name;
                env.WORDUP_INIT_TYPE = fields.type;

                const wpInstall = {
                    values: {
                        title: fields.title,
                        adminUser:fields.admin, 
                        adminPassword:fields.password, 
                        adminEmail:fields.email,
                        plugins:fields.plugins || {},
                        themes:{}
                    }
                };

                env.WORDUP_INIT_WP_INSTALL = Buffer.from(JSON.stringify(wpInstall)).toString('base64');

                let cpCall = cp.exec('wordup init --no-autoinstall', {cwd:this._extensionPath, env:env});
                
                token.onCancellationRequested(() => {
                    cpCall.kill();
                });

                cpCall.stdout.on('data', (data:any) => {
                    getOutputChannel().append(data);
                });

                cpCall.stderr.on('data', (data:any) => {
                    getOutputChannel().append(data);
                });

                cpCall.on('close', (code:number) => {
                    if(code !== 0){
                        vscode.window.showErrorMessage("Oops, something didn't work. Please take a look at the output window for more details.");
                    }else {
                        this.panel.dispose();
                        vscode.commands.executeCommand('wordupProjectView.refreshEntry');
                        vscode.window.showInformationMessage('Successfully init new wordup project.',...['Open in new window', 'Install dev server']).then(selection => {
                            const projectPath = path.join( fields.path , slugify(fields.name, {lower: true}));
                            if(selection === 'Open in new window'){
                                vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), true);
                            }else if(selection === 'Install dev server'){
                                vscode.commands.executeCommand('wordup.installDevServer', undefined, projectPath);
                            }
                        });
                    }
                    resolve();
                });
            });
        });

    }

    actionSelectFolder(){
        vscode.window.showOpenDialog({canSelectFiles:false, canSelectFolders:true, canSelectMany:false}).then(fileUri => {
            if (fileUri && fileUri[0]) {
                this.panel.webview.postMessage({ command: 'selectedFolder', value: fileUri[0].fsPath  });
            }
        });

    }

    getWebviewContent() {
        const htmlPathOnDisk = vscode.Uri.file(
			path.join(this._extensionPath, 'resources','html','wordupInit.html')
		);

        fs.readFile(htmlPathOnDisk.path, 'utf8',(err, contents) => {
            this.panel.webview.html = contents;
        });
    }

}