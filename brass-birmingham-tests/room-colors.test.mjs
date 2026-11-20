import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Room} from '../brass-birmingham/room.js';

class Connection extends EventEmitter {
 open=true;
 messages=[];
 send(message){this.messages.push(message);}
}

test('the host reserves unique colors for joins and pregame changes',()=>{
 const room=new Room(()=>{});
 room.isHost=true;room.count=4;
 room.seats=[{seat:0,name:'Host',online:true,color:'red'}];
 const client=new Connection();room.accept(client);
 client.emit('data',{kind:'join',name:'Guest',token:'guest',color:'red'});
 assert.deepEqual(room.lobby().seats.map(s=>s.color),['red','yellow']);
 client.emit('data',{kind:'color',color:'red'});
 assert.equal(room.seats[1].color,'yellow');
 client.emit('data',{kind:'color',color:'gray'});
 assert.equal(room.seats[1].color,'gray');
 assert.equal(client.messages.at(-1).data.seats[1].color,'gray');
 room.selectColor('purple');assert.equal(room.seats[0].color,'purple');
 room.started=true;client.emit('data',{kind:'color',color:'yellow'});
 assert.equal(room.seats[1].color,'gray');
});
