import React, { Component, ErrorInfo, ReactNode } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#fff" }}>
          <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 8 }}>😕 Something went wrong</Text>
          <Text style={{ fontSize: 14, color: "#666", textAlign: "center", marginBottom: 16 }}>
            The app ran into an error. Tap below to try again.
          </Text>
          <ScrollView style={{ maxHeight: 120, width: "100%", marginBottom: 20, backgroundColor: "#f5f5f5", borderRadius: 8, padding: 8 }}>
            <Text style={{ fontSize: 11, color: "#999", fontFamily: "monospace" }}>
              {this.state.error?.message ?? "Unknown error"}
            </Text>
          </ScrollView>
          <Pressable
            onPress={this.resetError}
            style={{ backgroundColor: "#FF6B35", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10 }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
