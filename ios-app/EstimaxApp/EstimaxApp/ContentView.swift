//
//  ContentView.swift
//  EstimaxApp
//
//  Created for Estimax iOS App
//

import SwiftUI

struct ContentView: View {
    // IMPORTANT: Change this URL to your Estimax server URL
    // For development: use your local IP address (e.g., "http://192.168.1.100:3000")
    // For production: use your domain (e.g., "https://estimax.yourdomain.com")
    let serverURL = "http://localhost:3000"

    var body: some View {
        WebView(url: URL(string: serverURL)!)
            .edgesIgnoringSafeArea(.all)
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
