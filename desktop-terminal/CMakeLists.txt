cmake_minimum_required(VERSION 3.21)

project(ProlineTerminal
    VERSION 0.1.0
    DESCRIPTION "Proline Markets desktop trading terminal"
    LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
# We don't use C++20 modules; disable the module dependency scanner (avoids a
# CMake/Ninja scan-rule generation bug on this toolchain).
set(CMAKE_CXX_SCAN_FOR_MODULES OFF)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

# Qt install root can be provided via -DCMAKE_PREFIX_PATH=C:/Qt/6.7.3/msvc2019_64
find_package(Qt6 REQUIRED COMPONENTS Widgets Network WebSockets Charts)

qt_standard_project_setup()

# --- Source tree (populated phase by phase) ---------------------------------
# Headers with Q_OBJECT are listed so AUTOMOC processes them.
set(TERMINAL_SOURCES
    src/main.cpp

    src/core/Session.h
    src/core/Session.cpp

    src/net/RestClient.h
    src/net/RestClient.cpp
    src/net/Api.h
    src/net/Api.cpp
    src/net/PriceSocket.h
    src/net/PriceSocket.cpp
    src/net/TradeSocket.h
    src/net/TradeSocket.cpp

    src/models/Account.h
    src/models/AccountSummary.h
    src/models/Instrument.h
    src/models/Tick.h
    src/models/Position.h
    src/models/Order.h
    src/models/Bar.h

    src/ui/LoginDialog.h
    src/ui/LoginDialog.cpp
    src/ui/MainWindow.h
    src/ui/MainWindow.cpp
    src/ui/MarketWatch.h
    src/ui/MarketWatch.cpp
    src/ui/OrderPanel.h
    src/ui/OrderPanel.cpp
    src/ui/PositionsTable.h
    src/ui/PositionsTable.cpp
    src/ui/OrdersTable.h
    src/ui/OrdersTable.cpp
    src/ui/ChartView.h
    src/ui/ChartView.cpp
)

qt_add_executable(ProlineTerminal WIN32 ${TERMINAL_SOURCES})

target_include_directories(ProlineTerminal PRIVATE src)

target_link_libraries(ProlineTerminal PRIVATE
    Qt6::Widgets
    Qt6::Network
    Qt6::WebSockets
    Qt6::Charts
)

# App version is compiled in so the UI and update-check can read it.
target_compile_definitions(ProlineTerminal PRIVATE
    PROLINE_APP_VERSION="${PROJECT_VERSION}"
)

# Copy Qt runtime DLLs next to the exe on Windows so it runs from the build dir.
if(WIN32)
    add_custom_command(TARGET ProlineTerminal POST_BUILD
        COMMAND Qt6::windeployqt
                --no-translations --no-compiler-runtime
                "$<TARGET_FILE:ProlineTerminal>"
        COMMENT "Deploying Qt runtime next to ProlineTerminal.exe"
        VERBATIM)
endif()
