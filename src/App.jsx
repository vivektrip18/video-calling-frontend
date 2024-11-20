import { Route, Routes, BrowserRouter } from 'react-router-dom'
import './App.css'
import { HomePage } from './pages/HomePage'
import { Meeting } from './pages/Meeting'
import {  useState } from 'react'
import { MeetingRoom } from './pages/MeetingRoom'
import { io } from "socket.io-client";



function App() {
  const [isloggedin, setLoggedin] = useState(false);
  const [username,setUsername] = useState("");

  const URL =io("https://video-calling-ye33.onrender.com", {
    transports: ["websocket"]
  });
  const [socket,setSocket] = useState(URL);

  return (
    <>
      <BrowserRouter>        
        <Routes>
          <Route
            path="/"
            element={<HomePage
              setLoggedin={setLoggedin}
              username={username}
              setUsername={setUsername}
            />}
          />

          <Route
            path="/meeting"
            element={
                <Meeting
                username={username} 
                setUsername={setUsername}
                socket={socket} 
                 />
            }
          />
          <Route
            path="/meeting/:meetingCode"
            element={<MeetingRoom username={username} socket={socket} setSocket={setSocket}/>
              }
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App
