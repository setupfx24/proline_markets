cmake_minimum_required(VERSION 3.21)
project(SwissCrestaTerminal VERSION 0.2.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_INCLUDE_CURRENT_DIR ON)

# Official Qt (MSVC) with WebEngine for the embedded TradingView charts.
find_package(Qt6 REQUIRED COMPONENTS Widgets Network WebSockets WebEngineWidgets WebChannel)

set(SOURCES
    src/main.cpp
    src/core/Config.cpp
    src/core/ApiClient.cpp
    src/core/PriceStream.cpp
    src/core/ChartBridge.cpp
    src/ui/LoginDialog.cpp
    src/ui/WatchlistWidget.cpp
    src/ui/WebChartWidget.cpp
    src/ui/OrderTicket.cpp
    src/ui/AccountPanel.cpp
    src/ui/PositionsPanel.cpp
    src/ui/WalletDialog.cpp
    src/ui/MainWindow.cpp
)

set(HEADERS
    src/core/Models.h
    src/core/Config.h
    src/core/ApiClient.h
    src/core/PriceStream.h
    src/core/ChartBridge.h
    src/ui/LoginDialog.h
    src/ui/WatchlistWidget.h
    src/ui/WebChartWidget.h
    src/ui/OrderTicket.h
    src/ui/AccountPanel.h
    src/ui/PositionsPanel.h
    src/ui/WalletDialog.h
    src/ui/MainWindow.h
)

qt_add_executable(terminal WIN32 ${SOURCES} ${HEADERS})

target_include_directories(terminal PRIVATE src)

# Lets WebChartWidget find web/index.html when running from the build tree.
target_compile_definitions(terminal PRIVATE
    SC_SOURCE_WEB_DIR="${CMAKE_SOURCE_DIR}/web")

target_link_libraries(terminal PRIVATE
    Qt6::Widgets
    Qt6::Network
    Qt6::WebSockets
    Qt6::WebEngineWidgets
    Qt6::WebChannel
)
