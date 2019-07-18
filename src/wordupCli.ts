import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const YAML = require('yaml');

import { WordupProjectView, isRootData } from './projectView';
import { getOutputChannel,wordupConformPath } from './utils';

export class WordupCli {

    public terminal:  vscode.Terminal;
    public projectView: WordupProjectView;
    readonly defaultPath: string;
    readonly extensionPath: string;

    constructor(context: vscode.ExtensionContext, projectView:WordupProjectView){

        this.projectView = projectView;

        this.terminal = vscode.window.createTerminal({name:'Wordup'});

        this.defaultPath = vscode.workspace.workspaceFolders ? wordupConformPath(vscode.workspace.workspaceFolders[0].uri.fsPath) : '';
        this.extensionPath = context.extensionPath;

        vscode.commands.registerCommand('wordup.installDevServer', async (node:any, directPath?:string) =>  {
            let aPath = this.defaultPath;
            if(directPath){
                aPath = directPath;
            }else if(node){
                aPath = node.data.path;
            }

            if(aPath){

                //Check if wpInstall is set
                fs.readFile(path.join(aPath,'.wordup', 'config.yml'), async (err, data) => {  
                    if (!err) {
                        const pjson = YAML.parse(data.toString('utf8'));

                        if(pjson.hasOwnProperty('wpInstall')){

                            //Check if other projects are running on this port
                            let runningProjects = undefined;
                            if(pjson.hasOwnProperty('port')){
                                runningProjects = await projectView.runningProjects(pjson.port);
                            } 
                            
                            if(runningProjects !== undefined){
                                vscode.window.showWarningMessage('A different project is running ('+runningProjects.data.name+')');
                            }else{
                                const addMsg = node ?  node.data.projectName+': '  : '';
                                this.execWordupCli('install', aPath, addMsg+'Successfully installed server', '⏳ Please be patient ');
                            }
                        }else {
                            this.execVscodeTerminal('wordup install', aPath);
                        }
                    }else{
                        this.execVscodeTerminal('wordup install', aPath);
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
                
                this.execWordupCli('start',  nodePath, selectedProject.data.name+': Successfully started server');
            }
        });
    
        vscode.commands.registerCommand('wordup.stopDevServer', (node:any) =>  {
            const nodePath = node ? node.data.path : undefined;
            const addMsg = node ?  node.data.projectName+': '  : '';

            this.execWordupCli('stop', nodePath, addMsg+'Successfully stopped server.');
        });

        vscode.commands.registerCommand('wordup.deleteDevServer', (node:any) =>  {
            const nodePath = node ? node.data.path : undefined;
            const addMsg = node ?  node.data.projectName+': '  : '';
            vscode.window.showWarningMessage('If you delete the server, all data on this server will be deleted. Your project source code will not been affected.',{modal:true}, ...['Delete']).then(selection => {
                if(selection === 'Delete'){
                    this.execWordupCli('stop --delete', nodePath, addMsg+'Successfully deleted server.');
                }
            });
        });

    }

    public execWordupCli(cmd:string, path?:string, successMsg?:string, infoMsg?:string){
        const projectPath = path ? path : this.defaultPath;
        if(!projectPath){
            vscode.window.showInformationMessage('No wordup project found');
        }else{
            
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Executing wordup-cli: wordup "+cmd,
                cancellable: true
            }, (progress, token) => {

                progress.report({ increment: 5 });

                setTimeout(() => progress.report({ increment: 15 }), 1000);
                setTimeout(() => progress.report({ increment: 15 }), 2000);
                setTimeout(() => progress.report({ increment: 15 }), 4000);
                setTimeout(() => progress.report({ increment: 10 }), 8000);
                setTimeout(() => progress.report({ increment: 5, message: (infoMsg ? " "+infoMsg : " 💤") }), 16000);

                return new Promise(resolve => {
                    getOutputChannel().clear();

                    let env = Object.create( process.env );
                    env.WORDUP_PROJECT_PATH = projectPath;

                    let cpCall = cp.exec('wordup '+cmd, {cwd:this.extensionPath, env:env});
                    
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
                                    this.execVscodeTerminal('wordup '+cmd, projectPath);
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

        this.terminal.sendText('cd '+path);
        this.terminal.sendText(cmd);
        this.terminal.show(true);
    }

}