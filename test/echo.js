
var port = parseInt(process.argv[2])

require('seneca')()
  .use('echo',{inject:{bar:2}})
  .use('..',{id:''+port})
  .listen( port )




 
