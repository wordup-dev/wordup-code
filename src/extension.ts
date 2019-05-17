// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { WordupProjectView } from './projectView';
import { WordupCli } from './wordupCli';

interface WordupTaskDefinition extends vscode.TaskDefinition {
	/**
	 * The task name
	 */
	task: string;

}

let taskProvider: vscode.Disposable | undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Setup the project view
    const projectView = new WordupProjectView(context);
    
    // Setup wordup cli commands
	const wordupCli = new WordupCli(context, projectView);

    //Add wordup status bar
    const wordupStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    wordupStatusBarItem.command = 'wordup.fastSelect';

	context.subscriptions.push(wordupStatusBarItem);

    // Update status bar item based on events for multi root folder changes
    if (vscode.workspace.workspaceFolders) {
        let wordupTaskPromise: Thenable<vscode.Task[]> | undefined = undefined;
        let pattern = path.join(vscode.workspace.workspaceFolders[0].uri.path, 'package.json');
	    let fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
        fileWatcher.onDidChange(() => {
            updateStatusBarItem(wordupStatusBarItem);
            wordupTaskPromise = undefined;
        });
        fileWatcher.onDidCreate(() => {
            updateStatusBarItem(wordupStatusBarItem);
            wordupTaskPromise = undefined;
        });
        fileWatcher.onDidDelete(() => {
            updateStatusBarItem(wordupStatusBarItem);
            wordupTaskPromise = undefined;
        });
        taskProvider = vscode.tasks.registerTaskProvider('wordup', {
            provideTasks: () => {
                if (!wordupTaskPromise) {
                    wordupTaskPromise = getWordupTasks();
                }
                return wordupTaskPromise;
            },
            resolveTask(_task: vscode.Task): vscode.Task | undefined {
                return undefined;
            }
        });

    }
    
    // update status bar item once at start
    updateStatusBarItem(wordupStatusBarItem);
    
}

// this method is called when your extension is deactivated
export function deactivate() {
    if (taskProvider) {
		taskProvider.dispose();
	}
}

async function updateStatusBarItem(status: vscode.StatusBarItem) {
    const info = await isWordupProject();

	if (info) {
		status.text = `$(gear) Wordup`;
		status.show();
	} else {
		status.hide();
	}
}

async function isWordupProject(checkLocal?:boolean): Promise<boolean> {

    // If no workspace is opened or just a single folder, we return without any status label
    // because our extension only works when more than one folder is opened in a workspace.

    if (!vscode.workspace.workspaceFolders) {
        return Promise.resolve(false);
    }

    const resource = await vscode.workspace.findFiles('package.json');

    // If we have a file:// resource we resolve the WorkspaceFolder this file is from and update
    // the status accordingly.
    return new Promise((resolve, reject) => {
        if (resource.length > 0 ) {
            fs.readFile(resource[0].fsPath, (err, data) => {  
                if (err) {
                    resolve(false);
                }

                const pjson = JSON.parse(data.toString('utf8'));
                if(pjson.hasOwnProperty('wordup')){
                    if(checkLocal){
                        //Check if wordup project has has local devDependency to wordup-cli
                        if(pjson.hasOwnProperty('devDependencies') && pjson.devDependencies.hasOwnProperty('wordup-cli')){
                            resolve(true);
                        }
                        resolve(false);
                    }else{
                        resolve(true);
                    }
                }else{
                    resolve(false);
                }
            });
        }
    });
}

async function getWordupTasks(): Promise<vscode.Task[]> {
	let workspaceRoot = vscode.workspace.workspaceFolders;
	let emptyTasks: vscode.Task[] = [];
	if (!workspaceRoot) {
		return emptyTasks;
	}
	if (!await isWordupProject()) {
		return emptyTasks;
    }

    let result: vscode.Task[] = [];
    let exportKind: WordupTaskDefinition = {
        label: 'Export the wordup src',
        type: 'wordup',
        task: 'export'
    };

    let exportTask = new vscode.Task(exportKind, 'export', 'wordup', new vscode.ShellExecution('wordup export'));
    exportTask.group = vscode.TaskGroup.Build;
    result.push(exportTask);

    /*let installKind: WordupTaskDefinition = {
        label: 'Install the wordup components',
        type: 'wordup',
        task: 'install'
    };

    let installTask = new vscode.Task(installKind, 'install', 'wordup', new vscode.ShellExecution('npx wordup install'));
    result.push(installTask);
    */


    return result;

}
