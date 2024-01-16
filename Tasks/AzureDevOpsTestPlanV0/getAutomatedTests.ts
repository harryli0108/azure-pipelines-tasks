﻿import { Console } from "console";
import tl = require('azure-pipelines-task-lib/task');
import apim = require('azure-devops-node-api');
import { WorkItemDetails, TestCase } from 'azure-devops-node-api/interfaces/TestPlanInterfaces';
import { PagedList } from 'azure-devops-node-api/interfaces/common/VSSInterfaces';
import TestPlanInterfaces = require('azure-devops-node-api/interfaces/TestPlanInterfaces');
import VSSInterfaces = require('azure-devops-node-api/interfaces/common/VSSInterfaces');


export interface TestPlanData {
    testPointIds: number[];
    listOfFQNOfTestCases: string[];
}

 const AutomatedTestName = "Microsoft.VSTS.TCM.AutomatedTestName";
 const AutomatedTestStorage = "Microsoft.VSTS.TCM.AutomatedTestStorage";
export async function getAutomatedTestData(testPlanId: number, testSuiteIds: number[], testConfigurationId: number): Promise<TestPlanData> {
    
    const testPlanData: TestPlanData = { testPointIds: [], listOfFQNOfTestCases: [] };
    let token = null;

    if (testPlanId == 0 || testConfigurationId == 0) {
        return testPlanData;
    }

    for (const testSuiteId of testSuiteIds) {
        if (testSuiteId === 0) {
            continue;
        }

        let testCasesData: TestCase[] = [];

        do {
            try {
                let testCasesResponse = await APICall1(testPlanId, testSuiteId, testConfigurationId.toString(), token);

                token = testCasesResponse.continuationToken;

                for (let key in testCasesResponse) {
                    if (testCasesResponse.hasOwnProperty(key)) {
                        testCasesData.push(testCasesResponse[key]);
                    }
                }

            } catch (error) {
                console.error("Error fetching test cases:", error);
                token = null;
            }
        } while (token !== undefined);

        if (testCasesData.length === 0) {
            console.log(`No test cases for test suite ${testSuiteId}`);
            continue;
        }

        testCasesData.forEach(testCase => {
            let automatedTestName = '';
            let automatedTestStorage = '';

            for (const witField of testCase.workItem?.workItemFields || []) {
                const parsedWitField = JSON.parse(JSON.stringify(witField)); // Deep copy for safety

                if (parsedWitField[AutomatedTestName] !== undefined) {
                    automatedTestName = parsedWitField[AutomatedTestName].toString();
                    testPlanData.listOfFQNOfTestCases.push(automatedTestName);
                }

                if (parsedWitField[AutomatedTestStorage] !== undefined) {
                    automatedTestStorage = parsedWitField[AutomatedTestStorage].toString();
                }
            }

            if (automatedTestName !== '' && automatedTestStorage !== '') {
                if (testCase.pointAssignments.length > 0) {
                    testPlanData.testPointIds.push(testCase.pointAssignments[0].id);
                }
            }
        });

    }

    return testPlanData;
}

export async function APICall1(testPlanId: number, testSuiteId: number, testConfigurationId: string, continuationToken: string): Promise<PagedList<TestCase>> {

    let url = tl.getEndpointUrl('SYSTEMVSSCONNECTION', false);
    let token = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
    let projectId = tl.getVariable('System.TeamProjectId');
    let auth = token.length == 52 ? apim.getPersonalAccessTokenHandler(token) : apim.getBearerHandler(token);
    let vsts: apim.WebApi = new apim.WebApi(url, auth);
    let testPlanApi = await vsts.getTestPlanApi();

    tl.debug("Fetching test case list for test plan:" + testPlanId + " test suite id:" + testSuiteId + " test configuration id:" + testConfigurationId + " continuation token:" + token);

    return testPlanApi.getTestCaseList(
        projectId,
        testPlanId,
        testSuiteId,
        null,
        testConfigurationId,
        null,
        continuationToken)

}