/* Copyright (c) 2013 Richard Rodger, MIT License */
"use strict";


var _     = require('underscore')
var uuid  = require('node-uuid')



module.exports = function( options ) {
  var seneca = this
  var name   = 'heart'



  options = seneca.util.deepextend({
    id: uuid(),
    monitor:false,

    minwait:1111,
    maxwait:2222,
    maxerr:11,
    culltime:(11*60*1000)
  },options)
  

  var nodeent = seneca.make$( 'farm/node' )


  // actions provided
  seneca.add( {role:name, cmd:'send-ping'},     
              {node:'required$'}, 
              send_ping )

  seneca.add( {role:name, cmd:'answer-ping'},    
              answer_ping )

  seneca.add( {role:name, cmd:'add-node'},    
              {id:'required$,string$'}, 
              add_node )

  seneca.add( {role:name, cmd:'remove-node'},    
              {id:'required$,string$'}, 
              remove_node )

  seneca.add( {role:name, cmd:'select'},    
              select_node )

  seneca.add( {role:name, cmd:'status'},    
              status )





  // resolve entity args by id
  seneca.act({
    role:   'util',
    cmd:    'ensure_entity',
    pin:    { role:name, cmd:'send-ping' },
    entmap: {
      node: nodeent,
    }
  })

  
  var pin = seneca.pin({ role:name, cmd:'*' })


  var clients  = {}
  var nodes    = []
  var actives  = []
  var pings    = {}


  function send_ping( args, done ) {
    var client = clients[args.node.id]

    if( !client ) {
      client = clients[args.node.id] = this.client( args.node.port, args.node.host, args.node.path )
    }

    client.act({role:name,cmd:'answer-ping',remote$:true,from:options.id},done)
  }



  function answer_ping( args, done ) {
    var out = {
      id: options.id,
      when: new Date().toISOString(),
      state:'ok'
    }
    done( null, out )
  }



  function add_node( args, done ) {
    nodeent
      .make$({
        id$:args.id,
        port:parseInt(args.port),
        host:args.host,
        path:args.path,
        active:false,
        errcount:0
      })
      .save$(function(err,node){
        if(err ) return done(err);

        nodes.push( node.id )
        nodes = _.uniq(nodes)
        execping( node.id )

        return done(null,{ok:true,node:node})
      })
  }


  function remove_node( args, done ) {
    nodeent
      .remove$( args.id, function(err,node){
        if(err ) return done(err);

        delete clients[args.id]
        nodes   = _.without( nodes, args.id )
        actives = _.without( actives, args.id )

        return done(null,{ok:true,id:args.id})
      })
  }


  function select_node( args, done ) {
    var nodeid = actives[actives.length*Math.random()]
    nodeent.load$(nodeid,done)
  }


  function status( args, done ) {
    nodeent.list$(function(err,list){
      if(err) return done(err);

      var out = {
        actives:_.clone(actives),
        pings:_.clone(pings),
        nodes:nodes,
        list:list
      }

      done(null,out)
    })

  }



  function nextping() {
    setTimeout( runping, options.minwait+(options.maxwait*Math.random()) )
  }

  function runping() {
    var nodeid = nodes[Math.floor(nodes.length*Math.random())]
    //console.log('runping:'+nodeid+' '+nodes)

    if( void 0 == nodeid ) {
      return nextping();
    }

    if( pings[nodeid] ) {
      return nextping();
    }
    
    execping(nodeid)
    nextping()
  }

  function execping(nodeid) {
    //console.log('execping:'+nodeid)
    if( void 0 == nodeid ) return;

    pings[nodeid] = true

    nodeent.load$(nodeid,function(err,node){
      if( err || void 0 == node ) {
        return pings[nodeid] = false;
      }

      seneca.act({role:name,cmd:'send-ping',node:node.id},function( pingerr, pingres ){
        if( pingerr ) {
          return badnode( node );
        }

        if( !node.active ) {
          node.since = new Date().toISOString()
        }
        node.active = true
        node.errcount = 0
        actives.push(node.id)
        actives = _.uniq(actives)

        seneca.log.debug('ping',true,node.id,node)

        node.save$(function(err,node){
          pings[nodeid] = false
        })
      })
    })
  }

  
  function badnode( node ) {
    seneca.log.debug('ping',false,node.id,node)

    if( node.active ) {
      node.since = new Date().toISOString()
    }
    node.errcount++
    if( options.maxerr < node.errcount ) {
      node.active = false
      actives = _.without(actives,node.id)
    }

    if( !node.active && options.culltime < new Date() - new Date(node.since) ) {
      seneca.act({role:name,cmd:'remove-node',id:node.id})
    }
    else {
      node.save$(function(err,node){
        if( err ) {
          pings[nodeid] = false
        }
        else setTimeout( function(){ execping(node.id) }, options.minwait+(options.maxwait*Math.random()) )
      })
    }
  }


  // define farm/node entity
  seneca.add({init:name}, function( args, done ){
    seneca.act('role:util, cmd:define_sys_entity', {list:[nodeent.canon$()]})

    if( options.monitor ) {

      nodeent.list$(function(err,list){
        if(err) return done(err);

        _.each( list, function(node){
          nodes.push(node.id)
          if( n.active ) {
            actives.push(n.id)
          }
        })
      })

      nextping()
    }
  })


  return {
    name: name
  }
}
