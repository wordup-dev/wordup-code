import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { WordupProjectView, isRootData } from './projectView';

export class WordupCli {

    public terminal:  vscode.Terminal;
    public projectView: WordupProjectView;
    readonly defaultPath: string;
    readonly extensionPath: string;

    constructor(context: vscode.ExtensionContext, projectView:WordupProjectView){

        this.projectView = projectView;

        this.terminal = vscode.window.createTerminal({name:'Wordup'});

        this.defaultPath = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.path : '';
        this.extensionPath = context.extensionPath;

        vscode.commands.registerCommand('wordup.installDevServer', async (node:any) =>  {
            const aPath = node ? node.data.path : this.defaultPath;

            if(aPath){
                //Check if wpInstall is set
                fs.readFile(path.join(aPath,'package.json'), async (err, data) => {  
                    if (!err) {
                        const pjson = JSON.parse(data.toString('utf8'));
                        if(pjson.hasOwnProperty('wordup') && pjson.wordup.hasOwnProperty('wpInstall')){

                            //Check if other projects are running on this port
                            const port = pjson.wordup.hasOwnProperty('port') ? pjson.wordup.port : '8000';
                            const runningProjects = await projectView.runningProjects(port);
                            if(runningProjects !== undefined){
                                vscode.window.showWarningMessage('A different project is running ('+runningProjects.data.name+')');
                            }else{
                                const addMsg = node ?  node.data.projectName+': '  : '';
                                this.execWordupCli('wordup install --force', aPath, addMsg+'Successfully installed server');
                            }
                        }else{
                            this.execVscodeTerminal('npx wordup install', aPath);
                        }
                    }
                });   
            }
        });
    
        vscode.commands.registerCommand('wordup.startDevServer', async (node:any) =>  {
            const nodePath = node ? node.data.path : this.defaultPath;

            const selectedProject = await projectView.findProjectByPath(nodePath);
            if(selectedProject && isRootData(selectedProject.data)){

                //Install project, instead of starting 
                if(!selectedProject.data.installedOnPort){
                    vscode.commands.executeCommand('wordup.installDevServer', node);
                    return;
                }
                
                //Check if other projects are running on this port 
                const runningProjects = await projectView.runningProjects( selectedProject.data.installedOnPort );
                if(runningProjects !== undefined){
                    vscode.window.showWarningMessage('A different project is running on port '+selectedProject.data.installedOnPort+' ('+runningProjects.data.name+')');
                    return;
                }

                this.execWordupCli('wordup start --force',  nodePath, selectedProject.data.name+': Successfully started server');
            }
        });
    
        vscode.commands.registerCommand('wordup.stopDevServer', (node:any) =>  {
            const nodePath = node ? node.data.path : undefined;
            const addMsg = node ?  node.data.projectName+': '  : '';

            this.execWordupCli('wordup stop', nodePath, addMsg+'Successfully stopped server.');
        });

        vscode.commands.registerCommand('wordup.deleteDevServer', (node:any) =>  {
            const nodePath = node ? node.data.path : undefined;
            const addMsg = node ?  node.data.projectName+': '  : '';
            vscode.window.showWarningMessage('If you delete the server, all data on this server will be deleted. Your project source code will not been affected.',{modal:true}, ...['Delete']).then(selection => {
                if(selection === 'Delete'){
                    this.execWordupCli('wordup stop --delete', nodePath, addMsg+'Successfully deleted server.');
                }
            });
        });

    }

    public execWordupCli(cmd:string, path?:string, successMsg?:string){
        const projectPath = path ? path : this.defaultPath;
        if(!projectPath){
            vscode.window.showInformationMessage('No wordup project found');
        }else{
            const npxCmd = 'npx '+cmd;
            
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Executing wordup-cli: "+cmd,
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

                    let env = Object.create( process.env );
                    env.WORDUP_PROJECT_PATH = projectPath;

                    let cpCall = cp.exec(npxCmd, {cwd:this.extensionPath, env:env});
                    
                    token.onCancellationRequested(() => {
                        cpCall.kill();
                    });

                    cpCall.stdout.on('data', (data:any) => {
                        getOutputChannel().append(data);
                    });

                    cpCall.stderr.on('data', (data:any) => {
                        getOutputChannel().append(data);
			            getOutputChannel().show(true);
                    });

                    cpCall.on('close', (code:number) => {
                        if(code !== 0){
                            vscode.window.showWarningMessage('We could not execute this command successfully. You can try it in your terminal. ', ...['Try in terminal']).then(selection => {
                                if(selection === 'Try in terminal'){
                                    this.execVscodeTerminal(cmd, projectPath);
                                }
                            });
                        }else if(successMsg){
                            vscode.window.showInformationMessage(successMsg);
                            vscode.commands.executeCommand('wordupProjectView.refreshEntry');
                        }
                        resolve();
                    });
                });
            });

        }



    }


    public execVscodeTerminal(cmd:string, path:string){

        this.terminal.sendText('cd '+path+' && clear');
        this.terminal.sendText(cmd);
        this.terminal.show();
    }

}


let _channel: vscode.OutputChannel;
export function getOutputChannel(): vscode.OutputChannel {
	if (!_channel) {
		_channel = vscode.window.createOutputChannel('Wordup');
	}
	return _channel;
}