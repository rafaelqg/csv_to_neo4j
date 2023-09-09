//docker run --name neo4j_container -p 7475:7474 -p 7688:7687 -d -v /neo4j/data:/data -v /neo4j/logs:/logs -v /neo4j/import:/var/lib/neo4j/import -v /neo4j/plugins:/plugins --env NEO4J_AUTH=neo4j/password neo4j:latest
const neo4j = require('neo4j-driver');// npm install --save neo4j-driver​
const fs = require('fs');


const driver = neo4j.driver('bolt://localhost:7688',neo4j.auth.basic('neo4j', "password"), {});

const clearNeo4jNodesAndEdges = "MATCH (n) DETACH DELETE n";

async function execCypher(cypher){
  const neo4JSession = driver.session({database:"neo4j"});
  let cypherResult = await neo4JSession.run(cypher);
  neo4JSession.close();
  return cypherResult;
}

async function processData(){
  let cypherResult = await execCypher(clearNeo4jNodesAndEdges);
  let dataFromCSVFile = fs.readFileSync('people-100000.csv', 'utf8');
  const COLUMNS_COUNT = 9;
  let lines = dataFromCSVFile.split("\r\n");
  lines = lines.slice(1,100);
  lines.forEach( async line => {
    let columns = line.split(",");
    if (columns.length === COLUMNS_COUNT){
      let firstName = columns[2];
      let lastName = columns[3];
      let userName = `${firstName} ${lastName}`;
      let jobTitle = columns[8];
      jobTitle = jobTitle.replace(/"/g,"");
      //create person node
      let cypherCreatePersonNode = `CREATE (n:Person {userName: '${userName}'})`;
      cypherResult = await execCypher(cypherCreatePersonNode);
      
      //create job node (if not existing yet)
      let cypherQuery =`match (j:Job) where j.jobTitle ='${jobTitle}' return j`;
      await execCypher(cypherQuery);
      const jobNodeExists = cypherResult.records.length > 0;
      if(!jobNodeExists){
        let cypherCreateJobNode = `CREATE (j:Job {jobTitle: '${jobTitle}'})`;
        await execCypher(cypherCreateJobNode);
      }
      //create relationship person and job
      let createRelationship = `MATCH (p:Person),(j:Job) WHERE p.userName = '${userName}' AND j.jobTitle ='${jobTitle}'
      CREATE (p)-[r:works]->(j)`;
      await execCypher(createRelationship);
      
    }
  });
  //testing import
  setTimeout( async  ()=>{
    let englishWorkTeachers = `match (p:Person)-[:works]-(j:Job) where j.jobTitle='English as a foreign language teacher' return p`
    cypherResult =  await execCypher(englishWorkTeachers);
    cypherResult.records.forEach( record => {
      record._fields.forEach(el =>{
        console.log(el.properties);
      })
    });
  }, 10000);
}

try{
  processData();
}catch(e){
  console.error(e);
}