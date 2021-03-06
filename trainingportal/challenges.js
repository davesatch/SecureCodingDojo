/**

Copyright 2017-2018 Trend Micro

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this work except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

 */
const path = require('path');
const fs = require('fs');
const markdown = require('markdown').markdown;
const util = require(path.join(__dirname, 'util'));
const challengeDefinitions = Object.freeze(require(path.join(__dirname, 'static/challenges/challengeDefinitions.json')));
const challengeSecrets = Object.freeze(require(path.join(__dirname, 'challengeSecrets.json')));
const config = require(path.join(__dirname, 'config'));
const db = require(path.join(__dirname, 'db'));
const async = require('async');


var challengeNames = [];
var solutions = [];
challengeDefinitions.forEach(function(level){
  level.challenges.forEach(function(challenge){
    challengeNames[challenge.id] = challenge.name;
    solutions[challenge.id] = challenge.solution;
  })
});

exports.getChallengeNames = function(){ return challengeNames; }
exports.getChallengeDefinitions = function(){ return challengeDefinitions; }
exports.getChallengeSecrets = function(){ return challengeSecrets; }

/**
 * Construct the challenge definitions loaded on the client side based on the users level
 * @param {The session user object} user 
 */
exports.getChallengeDefinitionsForUser = function (user) {
    var returnChallenges = [];
    var permittedLevel = user.level + 1;
    challengeDefinitions.forEach(function (level) {
        if (permittedLevel >= level.level) {
            level.challenges.forEach(function (challenge) {
                //update the play link if it exists
                if (!util.isNullOrUndefined(config.playLinks)) {
                    var playLink = config.playLinks[challenge.id];
                    if (!util.isNullOrUndefined(playLink)) {
                        challenge.playLink = playLink;
                    }
                }
            });
            returnChallenges.push(level);
        }
        else {
            returnChallenges.push({ "level": level.level, "name": level.name, "challenges": [] });
        }
    });
    return returnChallenges;
}

/**
 * Returns the solution html (converted from markdown)
 * @param {The challenge id} challengeId 
 */
exports.getSolution = function (challengeId) {
    var solution = solutions[challengeId];
    var solutionHtml = "";
    if(!util.isNullOrUndefined(solution)){
        var solutionMarkDown = fs.readFileSync(path.join(__dirname, solution),'utf8');
        solutionHtml = markdown.toHTML(solutionMarkDown);
    }

    return solutionHtml;
}

/**
 * Checks if the user should level up and execute level up. Passes the result, true or false to the cb
 */
exports.verifyLevelUp = function(user, errCb, doneCb){
    var level = user.level !== null ? user.level+1 : 1;
    async.waterfall([
        function(cb){
            db.fetchChallengeEntriesForUser(user,
                function(err){
                    util.log("Failed to fetch challenges for level up.", user);
                    cb(err);
                },
                function(entries){
                    cb(null,entries);
                });
        },
        function(entries,cb){
            if(entries!=null && entries.length>0 && challengeDefinitions.length > level) {
                //get challenges for current user level
                var challengeDefForLevel = challengeDefinitions[level].challenges;
                //check whether the entries match the level challenges
                var passCount = 0;
                challengeDefForLevel.forEach(function(challengeDef){
                    entries.forEach(function(entry){
                        if(entry.challengeId===challengeDef.id){
                            passCount++;
                        }
                    });
                });
                cb(null, passCount === challengeDefForLevel.length);
            }
            else{
                cb(null,false);
            }
        },
        function(shouldLevelUp,cb){
            if(shouldLevelUp){
                user.level = level;
                db.updateUser(user,
                    function(err){
                        util.log("Failed to update user for level up.", user);
                        cb(err);
                    },
                    function(result){
                        doneCb(true);
                    });
            }
            else{
                doneCb(false);
            }
        }
    ],function(err){
        errCb(err);
    });

}